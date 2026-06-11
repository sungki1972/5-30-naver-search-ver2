// 다나와식 제품 분류 (카탈로그 그룹핑).
// 다나와가 만들고 네이버 가격비교가 채택한 방식: 동일 규격 제품끼리 "카탈로그"로 묶고,
// 그룹 안에서만 최저가/중앙값을 계산한다. 전체 표본을 한 통에 섞으면
// 옵션묶음 미끼가·다른 와트·중고가 최저가를 오염시킨다 (예: LDS-D-10 6인치 2,800원 노이즈).
//
// 네이버 쇼핑검색 API productType:
//   1=가격비교 상품(카탈로그, lprice=셀러 통합 최저가) 2=가격비교 비매칭 일반상품
//   3=가격비교 매칭 일반상품  4~6=중고  7~9=단종  10~12=판매예정

import { extractOptionInch } from "./naver-filter";
import { CATALOG } from "./config";

export interface CatalogItem {
  title: string;
  lprice: number | null;
  product_type?: string | null;
  mall_name?: string | null;
  brand?: string | null;
}

export type TypeBucket =
  | "catalog" // 1: 네이버 가격비교 카탈로그 (신뢰 높음)
  | "matched" // 3: 카탈로그에 매칭된 일반상품
  | "normal" // 2: 비매칭 일반상품
  | "secondhand" // 4~6
  | "discontinued" // 7~9
  | "preorder" // 10~12
  | "unknown";

export function typeBucket(t: string | null | undefined): TypeBucket {
  const n = parseInt(t ?? "", 10);
  if (n === 1) return "catalog";
  if (n === 2) return "normal";
  if (n === 3) return "matched";
  if (n >= 4 && n <= 6) return "secondhand";
  if (n >= 7 && n <= 9) return "discontinued";
  if (n >= 10 && n <= 12) return "preorder";
  return "unknown";
}

export const TYPE_BUCKET_LABEL: Record<TypeBucket, string> = {
  catalog: "가격비교",
  matched: "카탈로그매칭",
  normal: "일반",
  secondhand: "중고",
  discontinued: "단종",
  preorder: "판매예정",
  unknown: "기타",
};

export interface Signature {
  inch: number | null;
  watt: number | null;
  multiSpec: boolean; // 한 제목에 서로 다른 규격 옵션 다수 → lprice는 최저 옵션 미끼가일 가능성
}

// 와트 추출: 서로 다른 W가 2개 이상이면 옵션묶음(multiSpec)
const WATT_RE = /(\d+(?:\.\d+)?)\s*[wW](?![a-zA-Z가-힣])/g;
export function extractWatt(text: string): { watt: number | null; multi: boolean } {
  const found = new Set<number>();
  WATT_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = WATT_RE.exec(text)) !== null) {
    const v = parseFloat(m[1]);
    if (!Number.isNaN(v) && v > 0 && v <= 400) found.add(v);
  }
  if (found.size === 1) return { watt: [...found][0], multi: false };
  return { watt: null, multi: found.size > 1 };
}

// 파이(타공) → 인치 환산 (naver-filter INCH_REQUIRE와 동일 매핑)
const PHI_TO_INCH: Array<[RegExp, number]> = [
  [/75\s*(?:파이|φ)|Φ\s*75/i, 3],
  [/10[05]\s*(?:파이|φ)|Φ\s*100/i, 4],
  [/12[05]\s*(?:파이|φ)|Φ\s*125/i, 5],
  [/15[05]\s*(?:파이|φ)|Φ\s*150/i, 6],
];

const INCH_ALL_RE = /(\d+(?:\.\d+)?)\s*인치/g;

export function extractSigInch(title: string): { inch: number | null; multi: boolean } {
  // ① 옵션 표기 우선 (ver1 extract_option_inch)
  const opt = extractOptionInch(title);
  if (opt != null) return { inch: opt, multi: false };
  // ② 본문 인치 언급
  const found = new Set<number>();
  INCH_ALL_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = INCH_ALL_RE.exec(title)) !== null) {
    const v = parseFloat(m[1]);
    if (!Number.isNaN(v)) found.add(v);
  }
  if (found.size === 1) return { inch: [...found][0], multi: false };
  if (found.size > 1) return { inch: null, multi: true };
  // ③ 파이 표기 환산
  for (const [re, inch] of PHI_TO_INCH) if (re.test(title)) return { inch, multi: false };
  return { inch: null, multi: false };
}

export function extractSignature(title: string): Signature {
  const i = extractSigInch(title);
  const w = extractWatt(title);
  return { inch: i.inch, watt: w.watt, multiSpec: i.multi || w.multi };
}

export function groupKeyOf(sig: Signature, fallbackInch: number | null): string {
  const inch = sig.inch ?? fallbackInch;
  return `${inch ?? "?"}인치|${sig.watt ?? "?"}W`;
}

export function groupLabelOf(key: string): string {
  const [inch, watt] = key.split("|");
  const i = inch === "?인치" ? "인치 미상" : inch;
  const w = watt === "?W" ? "W 미표기" : watt;
  return `${i} · ${w}`;
}

export interface ClassifiedListing<T extends CatalogItem = CatalogItem> {
  item: T;
  sig: Signature;
  bucket: TypeBucket;
  groupKey: string;
  included: boolean; // 시세 계산 반영 여부
  reason: string; // 제외 사유 (included=true면 "")
}

export interface CatalogGroup<T extends CatalogItem = CatalogItem> {
  key: string;
  label: string;
  isTarget: boolean; // SKU 규격에 해당하는 그룹인지
  items: ClassifiedListing<T>[];
  includedCount: number;
  low: number | null; // 그룹 내 반영 표본 최저
  median: number | null;
}

export interface ClassifyResult<T extends CatalogItem = CatalogItem> {
  listings: ClassifiedListing<T>[];
  groups: CatalogGroup<T>[]; // 타깃 우선 → 표본수 내림차순
  prices: number[]; // 시세 계산용 최종 가격
  excludedCount: number;
}

export interface SkuSpec {
  inch: number | null;
  spec?: string | null;
  name?: string | null;
}

function median(prices: number[]): number | null {
  if (!prices.length) return null;
  const s = [...prices].sort((a, b) => a - b);
  const n = s.length;
  return n % 2 ? s[(n - 1) / 2] : Math.round((s[n / 2 - 1] + s[n / 2]) / 2);
}

// SKU의 spec/name에서 기준 와트 도출 (없으면 null → 와트 무관 매칭)
export function skuWattOf(sku: SkuSpec): number | null {
  return extractWatt(`${sku.spec ?? ""} ${sku.name ?? ""}`).watt;
}

// 핵심: 리스팅을 카탈로그 그룹으로 분류하고, SKU 규격 그룹에서 아웃라이어를 걷어낸 시세 가격을 산출.
export function classifyListings<T extends CatalogItem>(
  sku: SkuSpec,
  items: T[],
): ClassifyResult<T> {
  const skuWatt = skuWattOf(sku);

  // 1) 시그니처/버킷/1차 포함 판정
  const classified: ClassifiedListing<T>[] = items.map((item) => {
    const sig = extractSignature(item.title);
    const bucket = typeBucket(item.product_type);
    const groupKey = groupKeyOf(sig, sku.inch);
    const price = item.lprice ?? 0;

    let included = true;
    let reason = "";
    if (bucket === "secondhand" || bucket === "discontinued" || bucket === "preorder") {
      included = false;
      reason = `${TYPE_BUCKET_LABEL[bucket]} 상품`;
    } else if (price <= 0) {
      included = false;
      reason = "가격 없음";
    } else if (sig.multiSpec) {
      included = false;
      reason = "옵션묶음 (대표가=최저옵션 미끼 가능)";
    } else if (sku.inch != null && sig.inch != null && sig.inch !== sku.inch) {
      included = false;
      reason = `인치 불일치 (${sig.inch}인치)`;
    } else if (skuWatt != null && sig.watt != null && sig.watt !== skuWatt) {
      included = false;
      reason = `와트 불일치 (${sig.watt}W ≠ ${skuWatt}W)`;
    }
    return { item, sig, bucket, groupKey, included, reason };
  });

  const targetKey = (k: string): boolean => {
    const [inchPart, wattPart] = k.split("|");
    const inchOk = sku.inch == null || inchPart === `${sku.inch}인치`;
    const wattOk = skuWatt == null || wattPart === `${skuWatt}W` || wattPart === "?W";
    return inchOk && wattOk;
  };

  // 2) 저가 아웃라이어 컷 (타깃 그룹 한정): 중앙값의 lowOutlierRatio 미만이면서
  //    클러스터(개수·판매처)가 작으면 제외. 충분히 모이면 실제 시장가로 인정.
  const pool = classified.filter((c) => c.included && targetKey(c.groupKey));
  const med = median(pool.map((c) => c.item.lprice ?? 0));
  if (med != null) {
    const fence = med * CATALOG.lowOutlierRatio;
    const lows = pool.filter((c) => (c.item.lprice ?? 0) < fence);
    const lowMalls = new Set(lows.map((c) => c.item.mall_name ?? "")).size;
    if (lows.length && (lows.length < CATALOG.minLowCluster || lowMalls < CATALOG.minLowMalls)) {
      for (const c of lows) {
        c.included = false;
        c.reason = `저가 아웃라이어 (중앙값 ${med.toLocaleString("ko-KR")}원의 ${CATALOG.lowOutlierRatio * 100}% 미만)`;
      }
    }
  }

  // 3) 그룹 빌드
  const byKey = new Map<string, ClassifiedListing<T>[]>();
  for (const c of classified) {
    const arr = byKey.get(c.groupKey) ?? [];
    arr.push(c);
    byKey.set(c.groupKey, arr);
  }
  const groups: CatalogGroup<T>[] = [...byKey.entries()].map(([key, grpItems]) => {
    const incl = grpItems.filter((c) => c.included).map((c) => c.item.lprice ?? 0);
    return {
      key,
      label: groupLabelOf(key),
      isTarget: targetKey(key),
      items: grpItems.sort((a, b) => (a.item.lprice ?? 0) - (b.item.lprice ?? 0)),
      includedCount: incl.length,
      low: incl.length ? Math.min(...incl) : null,
      median: median(incl),
    };
  });
  groups.sort((a, b) =>
    a.isTarget !== b.isTarget ? (a.isTarget ? -1 : 1) : b.items.length - a.items.length,
  );

  const prices = classified
    .filter((c) => c.included && targetKey(c.groupKey))
    .map((c) => c.item.lprice ?? 0)
    .filter((p) => p > 0);

  return {
    listings: classified,
    groups,
    prices,
    excludedCount: classified.filter((c) => !c.included).length,
  };
}
