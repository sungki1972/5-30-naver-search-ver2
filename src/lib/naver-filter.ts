// ver1 naver_lowest.py / price_verify.py 의 제목 필터 로직 TS 포팅.
// 조명(LDS 매입등) 도메인 기본값을 갖되, SKU별 설정으로 일반화 가능.

export interface FilterConfig {
  inch: number | null; // 대상 인치 (null이면 인치 검사 생략)
  lightKeywords: string[]; // 카테고리 필수 키워드 (하나 이상 포함)
  excludeKeywords: string[]; // 비대상 제외 키워드
  brandKeywords: string[]; // 브랜드 정품 필수 (하나 이상 포함; 비어있으면 검사 생략)
  minPrice: number;
}

export const DEFAULT_LIGHT_KEYWORDS = [
  "다운라이트", "매입등", "매립등", "매입조명", "매립조명", "downlight",
];

export const DEFAULT_NON_LIGHT_EXCLUDE = [
  "쇼핑백", "장바구니", "마트가방", "포켓", "시장가방", "시장장바구니",
  "지갑", "가방", "핸드백", "백팩", "마켓",
];

export const DEFAULT_BRAND_KEYWORDS = ["LDS", "리더스"];

// 인치별 필수 패턴 (ver1 INCH_REQUIRE_PATTERNS)
const INCH_REQUIRE: Record<number, RegExp[]> = {
  3: [/3\s*인치/i, /75\s*파이/i, /75\s*φ/i, /Φ\s*75/i],
  4: [/4\s*인치/i, /10[05]\s*파이/i, /100\s*φ/i, /Φ\s*100/i],
  5: [/5\s*인치/i, /12[05]\s*파이/i, /125\s*φ/i, /Φ\s*125/i],
  6: [/6\s*인치/i, /15[05]\s*파이/i, /150\s*φ/i, /Φ\s*150/i],
};

// 다른 인치 단독 표기 제외 (ver1 OTHER_INCH_SOLE)
const OTHER_INCH_SOLE: Record<number, RegExp[]> = {
  3: [/\b2\s*인치\b(?!.*3\s*인치)/, /\b4\s*인치\b(?!.*3\s*인치)/, /\b5\s*인치\b(?!.*3\s*인치)/, /\b6\s*인치\b(?!.*3\s*인치)/],
  4: [/\b2\s*인치\b(?!.*4\s*인치)/, /\b3\s*인치\b(?!.*4\s*인치)/, /\b5\s*인치\b(?!.*4\s*인치)/, /\b6\s*인치\b(?!.*4\s*인치)/],
  5: [/\b2\s*인치\b(?!.*5\s*인치)/, /\b3\s*인치\b(?!.*5\s*인치)/, /\b4\s*인치\b(?!.*5\s*인치)/],
  6: [/\b2\s*인치\b(?!.*6\s*인치)/, /\b3\s*인치\b(?!.*6\s*인치)/, /\b4\s*인치\b(?!.*6\s*인치)/],
};

export function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, "");
}

function hasRequiredInch(title: string, inch: number): boolean {
  const pats = INCH_REQUIRE[inch];
  if (!pats) return true; // 알려지지 않은 인치는 검사 생략
  return pats.some((p) => p.test(title));
}

function hasOnlyOtherInch(title: string, inch: number): boolean {
  if (hasRequiredInch(title, inch)) return false;
  const pats = OTHER_INCH_SOLE[inch];
  if (!pats) return false;
  return pats.some((p) => p.test(title));
}

// 제목 끝 옵션 표기에서 정확한 인치 추출 (ver1 extract_option_inch)
const OPTION_INCH_PATTERNS: RegExp[] = [
  /비츠온\s*(\d+(?:\.\d+)?)\s*인치/g,
  /리더스\s*(?:매입등\s*)?(\d+(?:\.\d+)?)\s*인치/g,
  /LDS\s*(\d+(?:\.\d+)?)\s*인치/g,
  /\[(\d+(?:\.\d+)?)\s*인치\]/g,
  /\((\d+(?:\.\d+)?)\s*인치\)/g,
  /(\d+(?:\.\d+)?)\s*인치\s*\([^)]*색\)/g,
  /색[)\)]?\s+(\d+(?:\.\d+)?)\s*인치\s+\d+(?:\.\d+)?\s*W/g,
  /\)\s+(\d+(?:\.\d+)?)\s*인치\s+\d+(?:\.\d+)?\s*W/g,
];

export function extractOptionInch(title: string): number | null {
  let lastInch: number | null = null;
  let lastIdx = -1;
  for (const pat of OPTION_INCH_PATTERNS) {
    pat.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pat.exec(title)) !== null) {
      if (m.index > lastIdx) {
        const v = parseFloat(m[1]);
        if (!Number.isNaN(v)) {
          lastInch = v;
          lastIdx = m.index;
        }
      }
    }
  }
  return lastInch;
}

export function defaultConfig(inch: number | null): FilterConfig {
  return {
    inch,
    lightKeywords: DEFAULT_LIGHT_KEYWORDS,
    excludeKeywords: DEFAULT_NON_LIGHT_EXCLUDE,
    brandKeywords: DEFAULT_BRAND_KEYWORDS,
    minPrice: 1500,
  };
}

// 품목별 자동 적응 필터 (범용 전기자재·조명):
// - 품명/검색어에 조명 키워드가 있으면 기존 다운라이트 필터(조명키워드 필수) 유지
// - 브랜드 검증은 품명/검색어에 해당 브랜드가 실제로 등장할 때만 적용
// - 그 외 품목은 카테고리/브랜드 강제 없이 인치·가격·제외어 검사만
export function configForProduct(p: {
  name: string;
  search_keywords?: string[] | null;
  inch: number | null;
}): FilterConfig {
  const text = `${p.name} ${(p.search_keywords ?? []).join(" ")}`;
  const up = text.toUpperCase();
  const isLighting = DEFAULT_LIGHT_KEYWORDS.some((k) => up.includes(k.toUpperCase()));
  const brands = DEFAULT_BRAND_KEYWORDS.filter((b) => up.includes(b.toUpperCase()));
  return {
    inch: p.inch,
    lightKeywords: isLighting ? DEFAULT_LIGHT_KEYWORDS : [],
    excludeKeywords: DEFAULT_NON_LIGHT_EXCLUDE,
    brandKeywords: brands,
    minPrice: 1500,
  };
}

// 통과 여부 + 사유 (ver1 title_filter)
export function titleFilter(
  title: string,
  cfg: FilterConfig,
): { ok: boolean; reason: string } {
  if (cfg.excludeKeywords.some((k) => title.includes(k)))
    return { ok: false, reason: "non-target category" };
  if (cfg.lightKeywords.length && !cfg.lightKeywords.some((k) => title.includes(k)))
    return { ok: false, reason: "no category keyword" };
  if (cfg.brandKeywords.length) {
    const up = title.toUpperCase();
    const brandOk = cfg.brandKeywords.some((b) =>
      b === b.toUpperCase() ? up.includes(b) : title.includes(b),
    );
    if (!brandOk) return { ok: false, reason: "brand mismatch" };
  }
  if (cfg.inch != null) {
    if (hasOnlyOtherInch(title, cfg.inch))
      return { ok: false, reason: "different inch only" };
    const optInch = extractOptionInch(title);
    if (optInch != null && optInch !== cfg.inch)
      return { ok: false, reason: `option inch=${optInch}, want ${cfg.inch}` };
    if (optInch == null && !hasRequiredInch(title, cfg.inch))
      return { ok: false, reason: "no precise inch indicator" };
  }
  return { ok: true, reason: "ok" };
}
