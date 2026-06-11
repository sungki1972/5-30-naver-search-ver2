import { ceilToThousand } from "./config";
import { MyProduct, PriceGapReportRow } from "./types";

export interface Distribution {
  n: number;
  min: number;
  p25: number;
  median: number;
  p75: number;
  max: number;
}

// ver1 price_verify.py stats 포팅
export function distribution(pricesIn: number[]): Distribution | null {
  if (!pricesIn.length) return null;
  const s = [...pricesIn].sort((a, b) => a - b);
  const n = s.length;
  const median =
    n % 2 ? s[(n - 1) / 2] : Math.round((s[n / 2 - 1] + s[n / 2]) / 2);
  return {
    n,
    min: s[0],
    p25: s[Math.max(0, Math.floor(n * 0.25) - 1)],
    median,
    p75: s[Math.min(n - 1, Math.floor(n * 0.75))],
    max: s[n - 1],
  };
}

// 권장가 = ceil(기준가 × (1 + margin) / 1000) × 1000 (ver1 사용자 룰; ceil 사용)
export function recommendedPrice(basis: number, minMargin: number): number {
  return ceilToThousand(basis * (1 + minMargin));
}

export interface PricingInput {
  product: MyProduct;
  marketPrices: number[]; // confidence 게이트 통과한 매칭 리스팅의 가격들
  runId: string;
  prevSnapshotMedian?: number | null; // WoW 비교용 직전 스냅샷 중앙값
}

export interface PricingResult {
  report: PriceGapReportRow;
  snapshot: {
    market_low: number | null;
    market_median: number | null;
    market_high: number | null;
    sample_count: number;
    my_price: number | null;
  };
}

export function analyze(input: PricingInput): PricingResult {
  const { product, marketPrices, runId, prevSnapshotMedian } = input;
  const dist = distribution(marketPrices);
  const myPrice = product.current_price;
  const purchase = product.purchase_price;

  const market_low = dist?.min ?? null;
  const market_median = dist?.median ?? null;
  const market_high = dist?.max ?? null;
  const sample_count = dist?.n ?? 0;

  // 기준가 선택 (price_basis)
  const basis =
    product.price_basis === "low" ? market_low : market_median ?? market_low;
  const recommended_price =
    basis != null ? recommendedPrice(basis, product.min_margin) : null;

  // 격차 % = (내판매가 - 시장최저)/시장최저
  const gap_pct =
    myPrice != null && market_low != null && market_low > 0
      ? round2(((myPrice - market_low) / market_low) * 100)
      : null;

  // 마진
  const margin = myPrice != null && purchase != null ? myPrice - purchase : null;
  const margin_pct =
    myPrice != null && purchase != null && myPrice > 0
      ? round2(((myPrice - purchase) / myPrice) * 100)
      : null;

  // 마진 침해: 시장최저가 매입가 아래로 내려갔거나, 내 판매가가 매입가 아래
  const margin_breach =
    (purchase != null && market_low != null && market_low < purchase) ||
    (purchase != null && myPrice != null && myPrice < purchase);

  // WoW 시세 변동 % (직전 스냅샷 중앙값 대비)
  const price_drop_pct =
    prevSnapshotMedian != null && prevSnapshotMedian > 0 && market_median != null
      ? round2(((market_median - prevSnapshotMedian) / prevSnapshotMedian) * 100)
      : null;

  const report: PriceGapReportRow = {
    sku_id: product.sku_id,
    run_id: runId,
    my_price: myPrice,
    purchase_price: purchase,
    market_low,
    market_median,
    recommended_price,
    gap_pct,
    margin,
    margin_pct,
    margin_breach,
    price_drop_pct,
    sample_count,
    summary: null, // Haiku 요약은 finalize에서 채움
  };

  return {
    report,
    snapshot: { market_low, market_median, market_high, sample_count, my_price: myPrice },
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
