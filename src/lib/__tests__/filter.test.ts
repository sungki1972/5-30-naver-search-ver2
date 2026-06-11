import { describe, it, expect } from "vitest";
import { titleFilter, defaultConfig, extractOptionInch, stripHtml } from "../naver-filter";

// ver1 naver_lowest.json 실데이터 기반 회귀 테스트
describe("titleFilter (ver1 회귀)", () => {
  const cfg3 = defaultConfig(3);

  it("LDS 3인치 옵션 정품 통과", () => {
    const t = "비츠온 LDS LED 다운라이트 매입등 매립등 주광 주백 전구 3인치 3.5인치 4인치 5인치 6인치  비츠온 3인치 전구색  1개";
    expect(titleFilter(t, cfg3).ok).toBe(true);
  });

  it("LDS 방습 3인치 리더스 통과", () => {
    const t = "[LDS] LED 방습 3인치 다운라이트 6W 매입등 욕실매립등 리더스라이팅";
    expect(titleFilter(t, cfg3).ok).toBe(true);
  });

  it("비-LDS 브랜드 탈락 (나스필)", () => {
    const t = "나스필 LED 리모컨 디밍 다운라이트 15w 5인치 6인치 원격 밝기조절 매입등 간접등";
    expect(titleFilter(t, cfg3).ok).toBe(false);
  });

  it("브랜드 없는 오염건 탈락 (타공130 5인치)", () => {
    const t = "매입등 LED 슬림 다운라이트 전구색 타공 130mm (5인치) 플리커프리";
    expect(titleFilter(t, cfg3).ok).toBe(false); // LDS/리더스 없음
  });

  it("다른 인치 옵션 탈락 (3인치 검색에 비츠온 6인치)", () => {
    const t = "비츠온 LDS LED 다운라이트 매입등 3인치 4인치 5인치 6인치  비츠온 6인치 주백색  1개";
    expect(titleFilter(t, cfg3).ok).toBe(false);
  });

  it("비조명 카테고리 탈락 (쇼핑백)", () => {
    const t = "LDS 리더스 시장 장바구니 쇼핑백 매입등 모양";
    expect(titleFilter(t, cfg3).ok).toBe(false);
  });

  it("조명 키워드 없으면 탈락", () => {
    const t = "LDS 리더스 LED 전구 3인치";
    expect(titleFilter(t, cfg3).ok).toBe(false);
  });
});

describe("extractOptionInch", () => {
  it("비츠온 N인치 추출", () => {
    expect(extractOptionInch("...비츠온 3인치 전구색  1개")).toBe(3);
    expect(extractOptionInch("...비츠온 6인치 주백색  1개")).toBe(6);
  });
  it("옵션 없으면 null", () => {
    expect(extractOptionInch("LDS 다운라이트 매입등 모음전")).toBeNull();
  });
});

describe("stripHtml", () => {
  it("HTML 태그 제거", () => {
    expect(stripHtml("<b>LDS</b> 다운라이트")).toBe("LDS 다운라이트");
  });
});
