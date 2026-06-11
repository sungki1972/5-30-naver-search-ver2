import { describe, it, expect } from "vitest";
import {
  extractWatt, extractSigInch, extractSignature, typeBucket, classifyListings, skuWattOf,
} from "../catalog";

const SKU5 = { inch: 5, spec: "5인치 15W", name: "LDS 5인치 다운라이트" };

function item(title: string, lprice: number, product_type = "2", mall_name = "몰A") {
  return { title, lprice, product_type, mall_name, brand: "LDS" };
}

describe("extractWatt", () => {
  it("단일 와트 추출", () => {
    expect(extractWatt("LDS 5인치 LED 다운라이트 15W 주광색")).toEqual({ watt: 15, multi: false });
  });
  it("소수점 와트", () => {
    expect(extractWatt("매입등 12.5W")).toEqual({ watt: 12.5, multi: false });
  });
  it("복수 와트 → 옵션묶음(multi)", () => {
    expect(extractWatt("LDS 다운라이트 8W/15W/20W 모음")).toEqual({ watt: null, multi: true });
  });
  it("와트 없음", () => {
    expect(extractWatt("LDS 5인치 다운라이트")).toEqual({ watt: null, multi: false });
  });
  it("단어 일부(Wi-Fi 등) 미오인", () => {
    expect(extractWatt("다운라이트 5Way")).toEqual({ watt: null, multi: false });
  });
});

describe("extractSigInch", () => {
  it("인치 표기", () => {
    expect(extractSigInch("LDS 5인치 다운라이트")).toEqual({ inch: 5, multi: false });
  });
  it("파이 표기 환산 (125파이=5인치)", () => {
    expect(extractSigInch("LED 매입등 125파이 타공")).toEqual({ inch: 5, multi: false });
  });
  it("복수 인치 옵션 → multi", () => {
    const r = extractSigInch("다운라이트 모음 4인치 5인치 6인치");
    expect(r.multi).toBe(true);
  });
  it("옵션 표기 우선 (ver1 extract_option_inch)", () => {
    expect(extractSigInch("리더스 매입등 (주광색) 5인치 15W").inch).toBe(5);
  });
});

describe("typeBucket", () => {
  it("네이버 productType 매핑", () => {
    expect(typeBucket("1")).toBe("catalog");
    expect(typeBucket("2")).toBe("normal");
    expect(typeBucket("3")).toBe("matched");
    expect(typeBucket("4")).toBe("secondhand");
    expect(typeBucket("8")).toBe("discontinued");
    expect(typeBucket("11")).toBe("preorder");
    expect(typeBucket(null)).toBe("unknown");
  });
});

describe("classifyListings — 다나와식 분류", () => {
  it("와트 불일치는 제외 (정확한 제품 단위)", () => {
    const cls = classifyListings(SKU5, [
      item("LDS 5인치 다운라이트 15W", 9000),
      item("LDS 5인치 다운라이트 20W", 12000),
      item("LDS 5인치 다운라이트 15W", 9500, "1"),
    ]);
    expect(cls.prices.sort((a, b) => a - b)).toEqual([9000, 9500]);
    const excluded = cls.listings.find((c) => c.item.lprice === 12000)!;
    expect(excluded.included).toBe(false);
    expect(excluded.reason).toContain("와트 불일치");
  });

  it("중고/단종/판매예정 제외", () => {
    const cls = classifyListings(SKU5, [
      item("LDS 5인치 다운라이트 15W", 9000),
      item("LDS 5인치 다운라이트 15W 중고", 4000, "4"),
      item("LDS 5인치 다운라이트 15W", 8500, "7"),
    ]);
    expect(cls.prices).toEqual([9000]);
  });

  it("옵션묶음(복수 와트) 제외 — 대표가 미끼 방지", () => {
    const cls = classifyListings(SKU5, [
      item("LDS 다운라이트 5인치 8W/15W/20W", 3000),
      item("LDS 5인치 다운라이트 15W", 9000),
    ]);
    expect(cls.prices).toEqual([9000]);
  });

  it("저가 아웃라이어 컷 — LDS-D-10 2,800원 노이즈 케이스", () => {
    const cls = classifyListings({ inch: 6, spec: null, name: "LDS 6인치" }, [
      item("LDS 6인치 다운라이트", 2800, "2", "몰X"),
      item("LDS 6인치 다운라이트", 9000),
      item("LDS 6인치 다운라이트", 9500, "2", "몰B"),
      item("LDS 6인치 다운라이트", 10000, "2", "몰C"),
      item("LDS 6인치 다운라이트", 9800, "2", "몰D"),
    ]);
    expect(Math.min(...cls.prices)).toBe(9000);
    const low = cls.listings.find((c) => c.item.lprice === 2800)!;
    expect(low.included).toBe(false);
    expect(low.reason).toContain("아웃라이어");
  });

  it("저가 클러스터가 충분하면 실제 시장가로 인정", () => {
    const cls = classifyListings({ inch: 6, spec: null, name: "LDS 6인치" }, [
      item("LDS 6인치 다운라이트", 4500, "2", "몰X"),
      item("LDS 6인치 다운라이트", 4600, "2", "몰Y"),
      item("LDS 6인치 다운라이트", 4700, "2", "몰Z"),
      item("LDS 6인치 다운라이트", 9500, "2", "몰B"),
      item("LDS 6인치 다운라이트", 10000, "2", "몰C"),
      item("LDS 6인치 다운라이트", 9800, "2", "몰D"),
      item("LDS 6인치 다운라이트", 9900, "2", "몰E"),
    ]);
    expect(Math.min(...cls.prices)).toBe(4500);
  });

  it("그룹: 타깃 그룹이 먼저, 그룹별 최저/중앙값 계산", () => {
    const cls = classifyListings(SKU5, [
      item("LDS 5인치 다운라이트 15W", 9000),
      item("LDS 5인치 다운라이트 20W", 12000),
      item("LDS 5인치 다운라이트 15W", 9500),
    ]);
    expect(cls.groups[0].isTarget).toBe(true);
    expect(cls.groups[0].low).toBe(9000);
    const g20 = cls.groups.find((g) => g.key === "5인치|20W")!;
    expect(g20.isTarget).toBe(false);
    expect(g20.includedCount).toBe(0); // 와트 불일치로 제외됨
  });

  it("SKU 와트 미상이면 와트 무관 매칭 (기존 동작 유지)", () => {
    const cls = classifyListings({ inch: 5, spec: null, name: "LDS 5인치" }, [
      item("LDS 5인치 다운라이트 15W", 9000),
      item("LDS 5인치 다운라이트 20W", 12000),
    ]);
    expect(cls.prices.sort((a, b) => a - b)).toEqual([9000, 12000]);
  });

  it("skuWattOf: spec에서 기준 와트 도출", () => {
    expect(skuWattOf(SKU5)).toBe(15);
    expect(skuWattOf({ inch: 5, spec: null, name: "LDS 5인치" })).toBe(null);
  });

  it("extractSignature 종합", () => {
    expect(extractSignature("LDS 5인치 15W 주광색")).toEqual({ inch: 5, watt: 15, multiSpec: false });
  });
});
