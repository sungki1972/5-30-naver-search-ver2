import { supabaseAdmin } from "./supabase";
import { MATCH_CONFIDENCE_THRESHOLD } from "./config";
import { classifyListings } from "./catalog";
import { analyze } from "./pricing";
import { saveSnapshot, saveReport, prevSnapshotMedian } from "./db";
import { MyProduct } from "./types";

interface ListingFields {
  title: string;
  lprice: number | null;
  mall_name: string | null;
  product_type: string | null;
  brand: string | null;
}

// 특정 run+sku의 남은 신뢰 리스팅으로 시세 스냅샷/격차 리포트를 재계산.
// (사용자가 잘못된 표본 리스팅을 삭제한 뒤 호출)
export async function recomputeSkuReport(runId: string, skuId: string) {
  const db = supabaseAdmin();

  const { data: product } = await db.from("naver_my_products").select("*").eq("sku_id", skuId).single();
  if (!product) throw new Error(`product ${skuId} 없음`);

  // 신뢰 매칭 + 연결된 리스팅 (삭제된 리스팅은 cascade로 사라져 자동 반영)
  const { data: matches } = await db
    .from("naver_product_matches")
    .select("confidence, naver_listings(title,lprice,mall_name,product_type,brand)")
    .eq("run_id", runId)
    .eq("sku_id", skuId)
    .gte("confidence", MATCH_CONFIDENCE_THRESHOLD);

  const items = (matches ?? [])
    .map((m) => {
      const l = m.naver_listings as unknown as ListingFields | ListingFields[] | null;
      return Array.isArray(l) ? l[0] : l;
    })
    .filter((l): l is ListingFields => !!l);

  // 다나와식 카탈로그 분류 (파이프라인과 동일 규칙)
  const cls = classifyListings(product as MyProduct, items);

  const prevMedian = await prevSnapshotMedian(skuId, runId);
  const { report, snapshot } = analyze({
    product: product as MyProduct,
    marketPrices: cls.prices,
    runId,
    prevSnapshotMedian: prevMedian,
  });
  await saveSnapshot(runId, skuId, snapshot);
  await saveReport(report);
  return { sample_count: snapshot.sample_count, market_low: snapshot.market_low };
}
