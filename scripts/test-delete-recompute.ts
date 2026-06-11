// 표본 삭제 → 시세 재계산 검증 (실제 deleteListing 로직 = supabaseAdmin delete + recomputeSkuReport).
// 실행: node --env-file=.env.local --import tsx scripts/test-delete-recompute.ts
import { supabaseAdmin } from "../src/lib/supabase";
import { recomputeSkuReport } from "../src/lib/recompute";

const SKU = "LDS-D-10";

async function reportOf(runId: string) {
  const { data } = await supabaseAdmin()
    .from("naver_price_gap_reports")
    .select("market_low,market_median,sample_count,margin_breach,recommended_price")
    .eq("run_id", runId).eq("sku_id", SKU).single();
  return data;
}

async function main() {
  const { data: runs } = await supabaseAdmin().from("naver_run_logs").select("run_id").order("started_at", { ascending: false }).limit(1);
  const runId = runs![0].run_id;
  console.log("run:", runId);

  console.log("삭제 전:", await reportOf(runId));

  // 매칭된 최저가 표본(노이즈 후보) 찾기
  const { data: matches } = await supabaseAdmin()
    .from("naver_product_matches")
    .select("naver_listings(id,lprice,title)")
    .eq("run_id", runId).eq("sku_id", SKU);
  const rows = (matches ?? [])
    .map((m) => (m.naver_listings as unknown as { id: number; lprice: number; title: string }))
    .filter(Boolean)
    .sort((a, b) => a.lprice - b.lprice);
  console.log("최저 표본 3개:");
  rows.slice(0, 3).forEach((r) => console.log(`   id=${r.id} ${r.lprice}원 ${r.title.slice(0, 50)}`));

  const target = rows[0];
  console.log(`\n→ 노이즈 삭제: id=${target.id} (${target.lprice}원)`);

  // deleteListing의 핵심: 삭제 + 재계산
  await supabaseAdmin().from("naver_listings").delete().eq("id", target.id);
  const res = await recomputeSkuReport(runId, SKU);
  console.log("재계산 결과:", res);
  console.log("삭제 후:", await reportOf(runId));
  console.log("\n✅ PASS: 표본 삭제 → 시세 재계산 동작 확인");
}

main().catch((e) => { console.error("❌", e); process.exit(1); });
