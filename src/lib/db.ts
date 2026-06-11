import { supabaseAdmin } from "./supabase";
import { MyProduct, NaverListingRow, PriceGapReportRow } from "./types";
import { MatchedListing } from "./match";

// run_id 생성: YYYYMMDD-HHmmss
export function makeRunId(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export async function loadActiveProducts(): Promise<MyProduct[]> {
  const { data, error } = await supabaseAdmin()
    .from("naver_my_products")
    .select("*")
    .eq("active", true)
    .order("sku_id");
  if (error) throw error;
  return (data ?? []) as MyProduct[];
}

export async function loadProductChunk(skuIds: string[]): Promise<MyProduct[]> {
  const { data, error } = await supabaseAdmin()
    .from("naver_my_products")
    .select("*")
    .in("sku_id", skuIds);
  if (error) throw error;
  return (data ?? []) as MyProduct[];
}

export async function createRun(runId: string, skuCount: number, chunkTotal: number) {
  const { error } = await supabaseAdmin().from("naver_run_logs").upsert(
    { run_id: runId, sku_count: skuCount, chunk_total: chunkTotal, status: "running" },
    { onConflict: "run_id" },
  );
  if (error) throw error;
}

export async function incrementRunProgress(
  runId: string,
  delta: { apiCalls?: number; matched?: number; errors?: number; chunkDone?: number },
) {
  // 원자적 증가를 위해 현재값 읽고 더함 (소규모 단일워커라 race 미미)
  const { data } = await supabaseAdmin().from("naver_run_logs").select("*").eq("run_id", runId).single();
  if (!data) return;
  await supabaseAdmin()
    .from("naver_run_logs")
    .update({
      api_calls: (data.api_calls ?? 0) + (delta.apiCalls ?? 0),
      matched_count: (data.matched_count ?? 0) + (delta.matched ?? 0),
      error_count: (data.error_count ?? 0) + (delta.errors ?? 0),
      chunk_done: (data.chunk_done ?? 0) + (delta.chunkDone ?? 0),
    })
    .eq("run_id", runId);
}

export async function runErrorCount(runId: string): Promise<number> {
  const { data } = await supabaseAdmin().from("naver_run_logs").select("error_count").eq("run_id", runId).single();
  return data?.error_count ?? 0;
}

export async function finalizeRun(runId: string, status: "done" | "partial" | "failed") {
  await supabaseAdmin()
    .from("naver_run_logs")
    .update({ status, finished_at: new Date().toISOString() })
    .eq("run_id", runId);
}

export async function isRunComplete(runId: string): Promise<boolean> {
  const { data } = await supabaseAdmin().from("naver_run_logs").select("*").eq("run_id", runId).single();
  if (!data) return false;
  return (data.chunk_done ?? 0) >= (data.chunk_total ?? 0);
}

export async function saveListings(rows: NaverListingRow[]): Promise<Map<string, number>> {
  if (!rows.length) return new Map();
  const clean = rows.map((r) => {
    const row = { ...r };
    delete row._price;
    delete row._confidence;
    delete row._match_method;
    return row;
  });
  const { data, error } = await supabaseAdmin()
    .from("naver_listings")
    .upsert(clean, { onConflict: "run_id,source_sku_id,product_id" })
    .select("id,product_id");
  if (error) throw error;
  const map = new Map<string, number>();
  for (const r of data ?? []) map.set(r.product_id, r.id);
  return map;
}

export async function saveMatches(
  runId: string,
  skuId: string,
  matched: MatchedListing[],
  listingIdByPid: Map<string, number>,
) {
  const rows = matched
    .map((m) => ({
      run_id: runId,
      sku_id: skuId,
      listing_id: listingIdByPid.get(m.product_id) ?? null,
      match_method: m._match_method,
      confidence: m._confidence,
      status: "scored",
    }))
    .filter((r) => r.listing_id != null);
  if (!rows.length) return;
  const { error } = await supabaseAdmin()
    .from("naver_product_matches")
    .upsert(rows, { onConflict: "run_id,sku_id,listing_id" });
  if (error) throw error;
}

export async function prevSnapshotMedian(skuId: string, runId: string): Promise<number | null> {
  const { data } = await supabaseAdmin()
    .from("naver_price_snapshots")
    .select("market_median,run_id")
    .eq("sku_id", skuId)
    .neq("run_id", runId)
    .order("date", { ascending: false })
    .limit(1);
  return data?.[0]?.market_median ?? null;
}

export async function saveSnapshot(
  runId: string,
  skuId: string,
  snap: { market_low: number | null; market_median: number | null; market_high: number | null; sample_count: number; my_price: number | null },
) {
  const { error } = await supabaseAdmin().from("naver_price_snapshots").upsert(
    { run_id: runId, sku_id: skuId, ...snap },
    { onConflict: "run_id,sku_id" },
  );
  if (error) throw error;
}

export async function saveReport(report: PriceGapReportRow) {
  const { error } = await supabaseAdmin()
    .from("naver_price_gap_reports")
    .upsert(report, { onConflict: "run_id,sku_id" });
  if (error) throw error;
}

export async function loadRunReports(runId: string): Promise<PriceGapReportRow[]> {
  const { data } = await supabaseAdmin()
    .from("naver_price_gap_reports")
    .select("*")
    .eq("run_id", runId);
  return (data ?? []) as PriceGapReportRow[];
}

// SKU별 차단된 네이버 상품 ID 집합 (수집 단계에서 건너뜀)
export async function loadBlockedPids(skuId: string): Promise<Set<string>> {
  const { data, error } = await supabaseAdmin()
    .from("naver_blocked_listings")
    .select("product_id")
    .eq("sku_id", skuId);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.product_id as string));
}

// 표본 차단 등록 (사용자 삭제 시 호출; 중복은 무시)
export async function blockListing(block: {
  sku_id: string;
  product_id: string;
  title: string | null;
  mall_name: string | null;
  lprice: number | null;
  image: string | null;
}) {
  const { error } = await supabaseAdmin()
    .from("naver_blocked_listings")
    .upsert(block, { onConflict: "sku_id,product_id", ignoreDuplicates: true });
  if (error) throw error;
}

// naver_listings 12주 초과분 prune
export async function pruneOldListings() {
  const cutoff = new Date(Date.now() - 84 * 24 * 3600 * 1000).toISOString();
  await supabaseAdmin().from("naver_listings").delete().lt("collected_at", cutoff);
}
