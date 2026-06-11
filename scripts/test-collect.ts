// 라이브 통합 테스트: 실제 네이버 API → 필터 → 매칭(regex만, Haiku 제외) → 다나와식 분류 → 분포.
// 실행: node --env-file=.env.local --import tsx scripts/test-collect.ts
import { collectForSku } from "../src/lib/collect";
import { distribution, recommendedPrice } from "../src/lib/pricing";
import { extractOptionInch } from "../src/lib/naver-filter";
import { classifyListings } from "../src/lib/catalog";
import { MyProduct } from "../src/lib/types";

const sku: MyProduct = {
  sku_id: "LDS-D-11",
  name: "LDS 매입등 다운라이트 5인치 12W",
  spec: "타공 125mm",
  inch: 5,
  purchase_price: 4000,
  current_price: 7000,
  category: "LED매입등",
  min_margin: 0.12,
  price_basis: "median",
  search_keywords: ["LDS 매입등 5인치", "LDS 다운라이트 5인치", "비츠온 LDS 5인치"],
  active: true,
};

async function main() {
  console.log(`\n=== 라이브 수집 테스트: ${sku.sku_id} (${sku.inch}인치) ===`);
  const t0 = Date.now();
  const { listings, rejected, apiCalls } = await collectForSku(sku, "TEST-RUN");
  const secs = ((Date.now() - t0) / 1000).toFixed(1);

  console.log(`API 호출: ${apiCalls} | 필터 통과: ${listings.length} | 탈락: ${rejected} | ${secs}s`);

  // regex 매칭 (인치 명시 확정)
  const confident = listings.filter((l) => {
    const opt = extractOptionInch(l.title);
    return opt === sku.inch || new RegExp(`${sku.inch}\\s*인치`).test(l.title);
  });

  // 구방식(전체 풀) vs 신방식(다나와식 카탈로그 분류) 비교
  const oldPrices = confident.map((l) => l._price!).filter(Boolean).sort((a, b) => a - b);
  const cls = classifyListings(sku, confident);
  const prices = [...cls.prices].sort((a, b) => a - b);
  const dist = distribution(prices);

  console.log(`\n신뢰 매칭(regex): ${confident.length}건 → 분류 제외 ${cls.excludedCount}건 → 시세 반영 ${prices.length}건`);
  console.log(`구방식 최저가: ${oldPrices[0] ?? "-"}원 → 신방식(분류 후) 최저가: ${prices[0] ?? "-"}원`);

  console.log("\n그룹 분포:");
  for (const g of cls.groups) {
    console.log(
      `  ${g.isTarget ? "★" : " "} ${g.label.padEnd(14)} 표본 ${String(g.items.length).padStart(3)} | 반영 ${String(g.includedCount).padStart(3)} | 최저 ${g.low ?? "-"} | 중앙값 ${g.median ?? "-"}`,
    );
  }

  console.log("\n제외 사유 샘플:");
  for (const c of cls.listings.filter((x) => !x.included).slice(0, 8)) {
    console.log(`  [${c.reason}] ${String(c.item.lprice).padStart(7)}원 | ${c.item.title.slice(0, 55)}`);
  }

  console.log("\n반영 표본 최저 10개:");
  for (const c of cls.listings.filter((x) => x.included).sort((a, b) => (a.item.lprice ?? 0) - (b.item.lprice ?? 0)).slice(0, 10)) {
    console.log(`  ${String(c.item.lprice).padStart(7)}원 | ${c.item.title.slice(0, 60)} | ${c.item.mall_name}`);
  }

  if (dist) {
    console.log(`\n분포: min=${dist.min} p25=${dist.p25} median=${dist.median} p75=${dist.p75} max=${dist.max} (n=${dist.n})`);
    console.log(`권장가(중앙값×1.12 천원올림): ${recommendedPrice(dist.median, sku.min_margin).toLocaleString()}원`);
    console.log(`내 판매가 ${sku.current_price}원 vs 시장최저 ${dist.min}원 → 격차 ${(((sku.current_price! - dist.min) / dist.min) * 100).toFixed(1)}%`);
  }

  // 검증 어서션
  if (apiCalls === 0) throw new Error("FAIL: API 호출 0");
  if (listings.length === 0) throw new Error("FAIL: 필터 통과 0 (필터 과잉 또는 API 문제)");
  console.log("\n✅ PASS: 라이브 수집+필터+분포 동작 확인");
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
