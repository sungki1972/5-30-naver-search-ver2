// 차단 목록이 실제 수집에서 스킵되는지 라이브 검증.
// 실행: node --env-file=.env.local --import tsx scripts/test-block-skip.ts [sku]
import { loadBlockedPids } from "../src/lib/db";
import { collectForSku } from "../src/lib/collect";
import { supabaseAdmin } from "../src/lib/supabase";
import { MyProduct } from "../src/lib/types";

async function main() {
  const skuId = process.argv[2] || "LDS-D-13";
  const blocked = await loadBlockedPids(skuId);
  console.log(`차단 목록: ${blocked.size}건`);
  if (!blocked.size) throw new Error("FAIL: 차단 목록 비어있음 (UI 차단 선행 필요)");

  const { data: product } = await supabaseAdmin().from("naver_my_products").select("*").eq("sku_id", skuId).single();
  if (!product) throw new Error("product 없음");

  const res = await collectForSku(product as MyProduct, "TEST-BLOCK", blocked);
  const leaked = res.listings.filter((l) => blocked.has(l.product_id));
  console.log(`수집: 통과 ${res.listings.length} / 차단스킵 ${res.blocked} / 누출 ${leaked.length}`);
  if (res.blocked < 1) throw new Error("FAIL: 차단 상품이 검색 결과에 없었음 (스킵 미발동)");
  if (leaked.length) throw new Error("FAIL: 차단 상품이 수집 결과에 누출");
  console.log("✅ PASS: 차단 상품이 다음 수집에서 제외됨");
}

main().catch((e) => { console.error("❌", e.message); process.exit(1); });
