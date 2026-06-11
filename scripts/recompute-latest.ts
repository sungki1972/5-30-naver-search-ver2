// 최신 run의 전 SKU 리포트를 현재 알고리즘(다나와식 카탈로그 분류)으로 재계산.
// 실행: node --env-file=.env.local --import tsx scripts/recompute-latest.ts
import { supabaseAdmin } from "../src/lib/supabase";
import { recomputeSkuReport } from "../src/lib/recompute";

async function main() {
  const db = supabaseAdmin();
  const { data: runs } = await db
    .from("naver_run_logs")
    .select("run_id")
    .order("started_at", { ascending: false })
    .limit(1);
  const runId = runs?.[0]?.run_id;
  if (!runId) throw new Error("실행 기록 없음");

  const { data: reports } = await db
    .from("naver_price_gap_reports")
    .select("sku_id,market_low,sample_count")
    .eq("run_id", runId);

  console.log(`run ${runId} — ${reports?.length ?? 0}개 SKU 재계산`);
  for (const r of reports ?? []) {
    const after = await recomputeSkuReport(runId, r.sku_id);
    console.log(
      `  ${r.sku_id}: 시장최저 ${r.market_low ?? "-"} → ${after.market_low ?? "-"} | 표본 ${r.sample_count} → ${after.sample_count}`,
    );
  }
  console.log("✅ 재계산 완료");
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
