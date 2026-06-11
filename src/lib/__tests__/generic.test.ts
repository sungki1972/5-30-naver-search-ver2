// 범용 전기자재 모드: 품목별 자동 적응 필터 + 토큰 겹침 매칭
import { describe, it, expect } from "vitest";
import { configForProduct, titleFilter } from "../naver-filter";
import { tokenOverlap, TOKEN_OVERLAP_MIN } from "../match";

describe("configForProduct — 품목별 자동 적응", () => {
  it("조명 품목: 조명키워드·브랜드 검증 유지 (기존 동작)", () => {
    const cfg = configForProduct({
      name: "LDS 매입등 다운라이트 5인치 12W",
      search_keywords: ["LDS 매입등 5인치"],
      inch: 5,
    });
    expect(cfg.lightKeywords.length).toBeGreaterThan(0);
    expect(cfg.brandKeywords).toContain("LDS");
    expect(cfg.inch).toBe(5);
  });

  it("비조명 범용 품목: 조명키워드·브랜드 강제 없음", () => {
    const cfg = configForProduct({
      name: "남영 누전차단기 30A",
      search_keywords: ["남영 누전차단기 30A"],
      inch: null,
    });
    expect(cfg.lightKeywords).toEqual([]);
    expect(cfg.brandKeywords).toEqual([]);
  });

  it("범용 설정으로 비조명 제목이 필터 통과", () => {
    const cfg = configForProduct({ name: "남영 누전차단기 30A", search_keywords: [], inch: null });
    expect(titleFilter("남영 누전차단기 NBE-32 30A 2P", cfg).ok).toBe(true);
  });

  it("조명 설정에서는 비조명 제목이 여전히 탈락 (회귀 방지)", () => {
    const cfg = configForProduct({
      name: "LDS 매입등 다운라이트 5인치",
      search_keywords: [],
      inch: 5,
    });
    expect(titleFilter("남영 누전차단기 NBE-32 30A 2P", cfg).ok).toBe(false);
  });
});

describe("extractAmp / 암페어 분류 — 전기자재 규격", () => {
  it("단일 암페어 추출, 차단용량(KA)은 미오인", async () => {
    const { extractAmp } = await import("../catalog");
    expect(extractAmp("누전차단기 30A 2P 3KA")).toEqual({ amp: 30, multi: false });
    expect(extractAmp("누전차단기 주택용")).toEqual({ amp: null, multi: false });
    expect(extractAmp("차단기 20A/30A/40A 모음")).toEqual({ amp: null, multi: true });
  });

  it("암페어 불일치 리스팅은 시세에서 제외", async () => {
    const { classifyListings } = await import("../catalog");
    const item = (title: string, lprice: number) =>
      ({ title, lprice, product_type: "2", mall_name: "몰", brand: "" });
    const cls = classifyListings(
      { inch: null, spec: null, name: "남영 누전차단기 30A" },
      [item("남영 누전차단기 30A 2P", 5000), item("남영 누전차단기 20A 2P", 3000)],
    );
    expect(cls.prices).toEqual([5000]);
    const ex = cls.listings.find((c) => c.item.lprice === 3000)!;
    expect(ex.reason).toContain("암페어 불일치");
  });
});

describe("tokenOverlap — 범용 품목 결정론 매칭", () => {
  it("핵심 토큰이 모두 포함되면 1.0", () => {
    expect(tokenOverlap("남영 누전차단기 30A", "남영 누전차단기 NBE-32 30a 2P 고급형")).toBe(1);
  });

  it("무관한 제목은 임계 미만", () => {
    expect(tokenOverlap("남영 누전차단기 30A", "LED 다운라이트 5인치")).toBeLessThan(TOKEN_OVERLAP_MIN);
  });

  it("부분 일치는 비율 반환", () => {
    const r = tokenOverlap("남영 누전차단기 30A", "누전차단기 30A 대만산");
    expect(r).toBeGreaterThan(0.5);
    expect(r).toBeLessThan(1);
  });
});
