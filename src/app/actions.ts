"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase";
import { recomputeSkuReport } from "@/lib/recompute";
import { searchQuery } from "@/lib/naver";
import { stripHtml, titleFilter, configForProduct } from "@/lib/naver-filter";
import { classifyListings, extractSigInch } from "@/lib/catalog";
import { tokenOverlap, TOKEN_OVERLAP_MIN } from "@/lib/match";

export interface ProductInput {
  sku_id: string;
  name: string;
  spec: string | null;
  inch: number | null;
  purchase_price: number | null;
  current_price: number | null;
  category: string | null;
  min_margin: number;
  price_basis: "low" | "median";
  search_keywords: string[];
  active: boolean;
}

export type ActionResult = { ok: true } | { ok: false; error: string };

// 고유코드 자동 생성: P-YYMMDD-HHMMSS (단일 사용자 환경에서 충분히 유일)
function genSkuId(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `P-${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export async function saveProduct(input: ProductInput): Promise<ActionResult> {
  if (!input.name?.trim()) return { ok: false, error: "상품명은 필수입니다." };
  const skuId = input.sku_id?.trim() || genSkuId();
  // 인치는 품명·검색어에서 자동 인식 (동일 규격 분류·필터에 사용; 없으면 인치 무관 품목)
  const derivedInch = extractSigInch(
    `${input.name} ${input.search_keywords.join(" ")}`,
  ).inch;
  const { error } = await supabaseAdmin()
    .from("naver_my_products")
    .upsert(
      {
        sku_id: skuId,
        name: input.name.trim(),
        spec: input.spec,
        inch: derivedInch,
        purchase_price: input.purchase_price,
        current_price: input.current_price,
        category: input.category,
        min_margin: input.min_margin,
        price_basis: input.price_basis,
        search_keywords: input.search_keywords,
        active: input.active,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "sku_id" },
    );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/products");
  revalidatePath("/");
  return { ok: true };
}

// 목록에서 활성/비활성 즉시 토글
export async function toggleProductActive(skuId: string, active: boolean): Promise<ActionResult> {
  const { error } = await supabaseAdmin()
    .from("naver_my_products")
    .update({ active, updated_at: new Date().toISOString() })
    .eq("sku_id", skuId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/products");
  return { ok: true };
}

export interface KeywordTestGroup {
  label: string;
  isTarget: boolean;
  count: number;
  low: number | null;
  median: number | null;
}

export interface KeywordTestResult {
  keyword: string;
  total: number; // API 수집 건수 (1페이지, 최대 100)
  passed: number; // 제목 필터 통과
  priced: number; // 카탈로그 분류 후 시세 반영 표본
  low: number | null;
  median: number | null;
  groups: KeywordTestGroup[];
  samples: string[]; // 통과 표본 제목 예시
}

// 저장 전 검색어 품질 미리보기: 라이브 네이버 검색(키워드당 1페이지) → 필터 → 다나와식 분류.
// 인치·와트는 품명·검색어에서 자동 인식 (저장 시와 동일 규칙).
export async function testSearchKeywords(
  keywords: string[],
  name: string,
): Promise<{ ok: true; results: KeywordTestResult[] } | { ok: false; error: string }> {
  const kws = keywords.map((k) => k.trim()).filter(Boolean).slice(0, 5);
  if (!kws.length) return { ok: false, error: "검색어를 입력하세요." };
  const inch = extractSigInch(`${name} ${kws.join(" ")}`).inch;
  try {
    const results: KeywordTestResult[] = [];
    for (const kw of kws) {
      const res = await searchQuery(kw, "asc", 1);
      const cfg = configForProduct({ name, search_keywords: kws, inch });
      const passedItems = res.items
        .map((it) => ({ ...it, _title: stripHtml(it.title) }))
        .filter((it) => {
          const price = parseInt(it.lprice, 10);
          if (!titleFilter(it._title, cfg).ok || Number.isNaN(price) || price < cfg.minPrice)
            return false;
          // 인치 없는 범용 품목: 파이프라인의 결정론 매칭(품명 토큰 겹침)을 미리보기에도 적용
          if (inch == null && tokenOverlap(name, it._title) < TOKEN_OVERLAP_MIN) return false;
          return true;
        })
        .map((it) => ({
          title: it._title,
          lprice: parseInt(it.lprice, 10),
          product_type: it.productType,
          mall_name: it.mallName,
          brand: it.brand,
        }));
      const cls = classifyListings({ inch, spec: null, name }, passedItems);
      const dist = [...cls.prices].sort((a, b) => a - b);
      results.push({
        keyword: kw,
        total: res.items.length,
        passed: passedItems.length,
        priced: cls.prices.length,
        low: dist[0] ?? null,
        median: dist.length ? dist[Math.floor((dist.length - 1) / 2)] : null,
        groups: cls.groups.slice(0, 6).map((g) => ({
          label: g.label, isTarget: g.isTarget, count: g.items.length, low: g.low, median: g.median,
        })),
        samples: passedItems.slice(0, 3).map((p) => p.title),
      });
    }
    return { ok: true, results };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "검색 테스트 실패" };
  }
}

export async function deleteProduct(skuId: string): Promise<ActionResult> {
  const { error } = await supabaseAdmin().from("naver_my_products").delete().eq("sku_id", skuId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/products");
  revalidatePath("/");
  return { ok: true };
}

// 잘못된 표본 리스팅 삭제 → 해당 SKU 시세/격차 재계산
export async function deleteListing(
  listingId: number,
  runId: string,
  skuId: string,
): Promise<ActionResult> {
  const { error } = await supabaseAdmin().from("naver_listings").delete().eq("id", listingId);
  if (error) return { ok: false, error: error.message };
  try {
    await recomputeSkuReport(runId, skuId);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "재계산 실패" };
  }
  revalidatePath(`/product/${skuId}`);
  revalidatePath("/");
  return { ok: true };
}
