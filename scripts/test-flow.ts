// end-to-end 통합 테스트: 시드 SKU → 수집 → 매칭 → 분석 → DB 영속화 → 리포트 조회.
// 요구: .env.local 에 SUPABASE_SERVICE_ROLE_KEY + ANTHROPIC_API_KEY (선택).
// 실행: npm run test:flow
import { loadActiveProducts, createRun, makeRunId, finalizeRun, loadRunReports } from "../src/lib/db";
import { processChunk } from "../src/lib/pipeline";

async function main() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log("⏭️  SKIP: SUPABASE_SERVICE_ROLE_KEY 미설정 — DB e2e 생략 (test-collect로 코어 검증됨)");
    process.exit(0);
  }

  const products = await loadActiveProducts();
  if (!products.length) {
    console.log("⏭️  SKIP: my_products 비어있음 — 0001/0002 마이그레이션 먼저 실행");
    process.exit(0);
  }
  console.log(`활성 SKU ${products.length}개`);

  const runId = makeRunId();
  const skuIds = products.slice(0, 2).map((p) => p.sku_id); // 처음 2개만 테스트
  await createRun(runId, skuIds.length, 1);
  console.log(`run ${runId} 생성, chunk 처리 (${skuIds.join(", ")})...`);

  const result = await processChunk(runId, skuIds);
  console.log("chunk 결과:", result);

  await finalizeRun(runId, "done");
  const reports = await loadRunReports(runId);
  console.log(`\n격차 리포트 ${reports.length}건:`);
  for (const r of reports) {
    console.log(`  ${r.sku_id}: 내가 ${r.my_price} / 시장최저 ${r.market_low} / 권장 ${r.recommended_price} / 격차 ${r.gap_pct}% / 침해 ${r.margin_breach}`);
  }

  if (!reports.length) throw new Error("FAIL: 리포트 0건");
  console.log("\n✅ PASS: e2e (수집→매칭→분석→영속화→조회) 동작 확인");
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
