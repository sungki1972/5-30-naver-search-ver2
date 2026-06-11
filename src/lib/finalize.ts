import Anthropic from "@anthropic-ai/sdk";
import { env, HAIKU_MODEL, ALERT } from "./config";
import { loadRunReports, finalizeRun, pruneOldListings, runErrorCount } from "./db";
import { sendTelegram } from "./telegram";
import { PriceGapReportRow } from "./types";

// run 완료 처리: 집계 → 이상징후 경보 → Haiku 주간 요약 → prune
export async function finalize(runId: string) {
  const reports = await loadRunReports(runId);

  const breaches = reports.filter((r) => r.margin_breach);
  const drops = reports.filter(
    (r) => r.price_drop_pct != null && r.price_drop_pct <= ALERT.priceDropPct,
  );

  // 이상징후 Telegram 경보
  if (breaches.length || drops.length) {
    await sendTelegram(buildAlert(runId, breaches, drops));
  }

  // Haiku 주간 요약 (선택)
  try {
    const summary = await weeklySummary(runId, reports);
    if (summary) await sendTelegram(`📊 <b>주간 시세 리포트</b> (${runId})\n\n${summary}`);
  } catch (e) {
    console.error("[finalize] 요약 실패:", e);
  }

  await pruneOldListings();
  const errors = await runErrorCount(runId);
  await finalizeRun(runId, errors > 0 ? "partial" : "done");
}

function fmt(n: number | null): string {
  return n == null ? "-" : n.toLocaleString("ko-KR") + "원";
}

function buildAlert(runId: string, breaches: PriceGapReportRow[], drops: PriceGapReportRow[]): string {
  const lines: string[] = [`⚠️ <b>시세 경보</b> (${runId})`];
  if (breaches.length) {
    lines.push(`\n<b>마진 침해 ${breaches.length}건</b> (시세가 매입가 아래):`);
    for (const b of breaches.slice(0, 15))
      lines.push(`• ${b.sku_id}: 시장최저 ${fmt(b.market_low)} / 매입 ${fmt(b.purchase_price)}`);
  }
  if (drops.length) {
    lines.push(`\n<b>시세 급락 ${drops.length}건</b> (WoW ≤ ${ALERT.priceDropPct}%):`);
    for (const d of drops.slice(0, 15))
      lines.push(`• ${d.sku_id}: ${d.price_drop_pct}% → 중앙값 ${fmt(d.market_median)}`);
  }
  return lines.join("\n");
}

async function weeklySummary(runId: string, reports: PriceGapReportRow[]): Promise<string | null> {
  if (!reports.length) return null;
  const client = new Anthropic({ apiKey: env.anthropicKey() });
  const compact = reports.map((r) => ({
    sku: r.sku_id,
    my: r.my_price,
    low: r.market_low,
    med: r.market_median,
    rec: r.recommended_price,
    gap: r.gap_pct,
    breach: r.margin_breach,
  }));
  const msg = await client.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 800,
    system: [{ type: "text", text: "당신은 도소매 사장님을 돕는 가격 애널리스트입니다. 데이터를 보고 한국어로 간결한 액션 중심 요약(불릿 5개 이내)을 작성하세요. 내 판매가가 시세보다 너무 높거나 낮은 품목, 마진 침해 품목을 우선 언급하세요.", cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: `이번 주 격차 리포트(JSON):\n${JSON.stringify(compact)}` }],
  });
  return msg.content.find((c) => c.type === "text")?.text ?? null;
}
