import { describe, it, expect } from "vitest";
import { distribution, recommendedPrice, analyze } from "../pricing";
import { ceilToThousand } from "../config";
import { MyProduct } from "../types";

describe("ceilToThousand", () => {
  it("천원 단위 올림", () => {
    expect(ceilToThousand(5005)).toBe(6000);
    expect(ceilToThousand(4950)).toBe(5000);
    expect(ceilToThousand(7000)).toBe(7000);
  });
});

describe("distribution (ver1 stats 포팅)", () => {
  it("min/median/max 정확", () => {
    const d = distribution([3290, 4000, 4550, 5800, 7000])!;
    expect(d.min).toBe(3290);
    expect(d.median).toBe(4550);
    expect(d.max).toBe(7000);
    expect(d.n).toBe(5);
  });
  it("빈 배열은 null", () => {
    expect(distribution([])).toBeNull();
  });
});

describe("recommendedPrice (ver1 사용자 룰)", () => {
  it("기준가 × (1+margin) → 천원 올림", () => {
    // 4550 × 1.12 = 5096 → 6000
    expect(recommendedPrice(4550, 0.12)).toBe(6000);
    // 5800 × 1.12 = 6496 → 7000
    expect(recommendedPrice(5800, 0.12)).toBe(7000);
  });
});

describe("analyze", () => {
  const base: MyProduct = {
    sku_id: "LDS-D-13", name: "테스트", spec: null, inch: 3,
    purchase_price: 3200, current_price: 7000, category: null,
    min_margin: 0.12, price_basis: "median", search_keywords: [], active: true,
  };

  it("마진/격차/권장가 계산", () => {
    const { report } = analyze({ product: base, marketPrices: [3290, 4000, 4550, 5800, 7000], runId: "T" });
    expect(report.market_low).toBe(3290);
    expect(report.market_median).toBe(4550);
    expect(report.margin).toBe(3800); // 7000-3200
    expect(report.recommended_price).toBe(6000); // median 4550 ×1.12 → 6000
    expect(report.margin_breach).toBe(false);
  });

  it("시세가 매입가 아래면 마진 침해", () => {
    const { report } = analyze({ product: base, marketPrices: [2000, 2500, 3000], runId: "T" });
    expect(report.margin_breach).toBe(true); // market_low 2000 < 매입 3200
  });

  it("매칭 없으면 null 안전", () => {
    const { report, snapshot } = analyze({ product: base, marketPrices: [], runId: "T" });
    expect(report.market_low).toBeNull();
    expect(report.recommended_price).toBeNull();
    expect(snapshot.sample_count).toBe(0);
  });

  it("WoW 급락 계산", () => {
    const { report } = analyze({ product: base, marketPrices: [4000, 5000, 6000], runId: "T", prevSnapshotMedian: 8000 });
    // median 5000 vs prev 8000 → -37.5%
    expect(report.price_drop_pct).toBe(-37.5);
  });
});
