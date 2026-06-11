import Anthropic from "@anthropic-ai/sdk";
import { env, HAIKU_MODEL } from "./config";
import { extractOptionInch } from "./naver-filter";
import { MyProduct, NaverListingRow } from "./types";

// 2단 매칭 깔때기
//  ① 결정론(regex): 필터 통과 + 인치 정확 일치 → confidence 1.0
//  ② 애매건만 Claude Haiku 판정 → confidence
// Haiku 장애 시 폴백: match_method='none', confidence=0 (리포트 "미확정")

export interface MatchedListing extends NaverListingRow {
  _confidence: number;
  _match_method: "regex" | "llm" | "none";
}

export async function matchListings(
  sku: MyProduct,
  listings: NaverListingRow[],
): Promise<MatchedListing[]> {
  const out: MatchedListing[] = [];
  const ambiguous: NaverListingRow[] = [];

  for (const l of listings) {
    // ① 결정론: 인치 명시 일치면 확정
    if (sku.inch != null) {
      const opt = extractOptionInch(l.title);
      const inchInTitle = opt === sku.inch || new RegExp(`${sku.inch}\\s*인치`).test(l.title);
      if (inchInTitle) {
        out.push({ ...l, _confidence: 1.0, _match_method: "regex" });
        continue;
      }
      ambiguous.push(l);
    } else {
      // 인치 정보 없는 도메인: 필터 통과를 신뢰(regex 1.0)
      out.push({ ...l, _confidence: 1.0, _match_method: "regex" });
    }
  }

  if (ambiguous.length) {
    const judged = await judgeWithHaiku(sku, ambiguous).catch((e) => {
      console.error("[match] Haiku 폴백:", e?.message ?? e);
      return ambiguous.map((l) => ({ ...l, _confidence: 0, _match_method: "none" as const }));
    });
    out.push(...judged);
  }
  return out;
}

async function judgeWithHaiku(
  sku: MyProduct,
  listings: NaverListingRow[],
): Promise<MatchedListing[]> {
  const client = new Anthropic({ apiKey: env.anthropicKey() });
  const results: MatchedListing[] = [];

  // 배치로 묶어 한 번에 판정 (토큰 절감 + 프롬프트 캐싱)
  const system = `당신은 전기자재·조명 상품 매칭 판정기입니다. 기준 상품과 후보 리스팅이 "동일 규격 제품"인지 판정합니다. 규격(인치/와트/타공)이 다르면 동일 제품이 아닙니다. 반드시 JSON만 출력하세요.`;

  const prompt = `기준 상품:
- 이름: ${sku.name}
- 규격: ${sku.spec ?? "(없음)"}
- 인치: ${sku.inch ?? "(없음)"}

후보 리스팅 (index: title):
${listings.map((l, i) => `${i}: ${l.title}`).join("\n")}

각 후보에 대해 동일 규격 제품일 확률을 판정해 JSON 배열로 출력:
[{"index":0,"is_same":true,"confidence":0.0~1.0,"reason":"간단사유"}, ...]`;

  const msg = await client.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 2048,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: prompt }],
  });

  const text = msg.content.find((c) => c.type === "text")?.text ?? "[]";
  let parsed: Array<{ index: number; confidence: number }> = [];
  try {
    const json = text.slice(text.indexOf("["), text.lastIndexOf("]") + 1);
    parsed = JSON.parse(json);
  } catch {
    parsed = [];
  }
  const byIdx = new Map(parsed.map((p) => [p.index, p.confidence]));

  listings.forEach((l, i) => {
    const conf = byIdx.get(i) ?? 0;
    results.push({ ...l, _confidence: conf, _match_method: "llm" });
  });
  return results;
}
