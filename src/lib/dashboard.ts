import { supabaseAdmin } from "./supabase";

export interface DashboardState {
  configured: boolean;
  error?: string;
}

export function dbConfigured(): boolean {
  return !!process.env.SUPABASE_SERVICE_ROLE_KEY && !!process.env.NEXT_PUBLIC_SUPABASE_URL;
}

export async function latestRunId(): Promise<string | null> {
  const { data } = await supabaseAdmin()
    .from("naver_run_logs")
    .select("run_id")
    .order("started_at", { ascending: false })
    .limit(1);
  return data?.[0]?.run_id ?? null;
}

export interface ReportRow {
  sku_id: string;
  name: string | null;
  category: string | null;
  my_price: number | null;
  purchase_price: number | null;
  market_low: number | null;
  market_median: number | null;
  recommended_price: number | null;
  gap_pct: number | null;
  margin: number | null;
  margin_pct: number | null;
  margin_breach: boolean;
  price_drop_pct: number | null;
  sample_count: number;
}

export async function reportsForRun(runId: string): Promise<ReportRow[]> {
  const { data: reports } = await supabaseAdmin()
    .from("naver_price_gap_reports")
    .select("*")
    .eq("run_id", runId);
  const { data: products } = await supabaseAdmin()
    .from("naver_my_products")
    .select("sku_id,name,category");
  const byId = new Map((products ?? []).map((p) => [p.sku_id, p]));
  return (reports ?? []).map((r) => ({
    ...r,
    name: byId.get(r.sku_id)?.name ?? null,
    category: byId.get(r.sku_id)?.category ?? null,
  })) as ReportRow[];
}

export async function recentRuns(limit = 20) {
  const { data } = await supabaseAdmin()
    .from("naver_run_logs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function snapshotsForSku(skuId: string) {
  const { data } = await supabaseAdmin()
    .from("naver_price_snapshots")
    .select("date,market_low,market_median,market_high,my_price")
    .eq("sku_id", skuId)
    .order("date", { ascending: true });
  return data ?? [];
}

export async function productById(skuId: string) {
  const { data } = await supabaseAdmin().from("naver_my_products").select("*").eq("sku_id", skuId).single();
  return data;
}

export async function allProducts() {
  const { data } = await supabaseAdmin()
    .from("naver_my_products")
    .select("*")
    .order("sku_id");
  return data ?? [];
}

export interface BlockedRow {
  id: number;
  product_id: string;
  title: string | null;
  mall_name: string | null;
  lprice: number | null;
  image: string | null;
  blocked_at: string;
}

// SKU의 영구 차단 목록 (다음 스캔부터 미수집)
export async function blockedForSku(skuId: string): Promise<BlockedRow[]> {
  const { data } = await supabaseAdmin()
    .from("naver_blocked_listings")
    .select("id,product_id,title,mall_name,lprice,image,blocked_at")
    .eq("sku_id", skuId)
    .order("blocked_at", { ascending: false });
  return (data ?? []) as BlockedRow[];
}

export interface ListingRow {
  id: number;
  title: string;
  lprice: number | null;
  mall_name: string | null;
  product_id: string | null;
  product_type: string | null;
  brand: string | null;
  image: string | null;
  link: string | null;
  confidence: number;
  counted: boolean; // 신뢰도 게이트(confidence >= 임계) 통과 여부
}

// 특정 SKU의 한 run에서 매칭된 리스팅들 (신뢰도 포함). 잘못된 표본 검토/삭제용.
export async function listingsForSku(runId: string, skuId: string): Promise<ListingRow[]> {
  const { data } = await supabaseAdmin()
    .from("naver_product_matches")
    .select("confidence, naver_listings(id,title,lprice,mall_name,product_id,product_type,brand,image,link)")
    .eq("run_id", runId)
    .eq("sku_id", skuId);
  const threshold = Number(process.env.MATCH_CONFIDENCE_THRESHOLD ?? "0.80");
  const rows: ListingRow[] = [];
  for (const m of data ?? []) {
    const raw = (m as { naver_listings: unknown }).naver_listings;
    const l = (Array.isArray(raw) ? raw[0] : raw) as {
      id: number; title: string; lprice: number | null; mall_name: string | null;
      product_id: string | null; product_type: string | null; brand: string | null;
      image: string | null; link: string | null;
    } | null;
    if (!l) continue;
    rows.push({
      id: l.id, title: l.title, lprice: l.lprice, mall_name: l.mall_name,
      product_id: l.product_id, product_type: l.product_type, brand: l.brand,
      image: l.image, link: l.link,
      confidence: m.confidence as number,
      counted: (m.confidence as number) >= threshold,
    });
  }
  return rows.sort((a, b) => (a.lprice ?? 0) - (b.lprice ?? 0));
}
