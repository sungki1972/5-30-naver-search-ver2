import { searchQuery } from "./naver";
import { stripHtml, titleFilter, configForProduct } from "./naver-filter";
import { COLLECT } from "./config";
import { MyProduct, NaverItem, NaverListingRow } from "./types";

export interface CollectResult {
  listings: NaverListingRow[]; // 필터 통과 + dedup (최저가 유지)
  rejected: number;
  apiCalls: number;
}

// SKU 하나에 대해 search_keywords × (asc+sim) 수집 → 필터 → productId dedup(최저가 유지)
export async function collectForSku(sku: MyProduct, runId: string): Promise<CollectResult> {
  const cfg = configForProduct(sku);
  const byPid = new Map<string, NaverListingRow>();
  let rejected = 0;
  let apiCalls = 0;

  const keywords = sku.search_keywords.length ? sku.search_keywords : [sku.name];

  for (const kw of keywords) {
    for (const sort of ["asc", "sim"] as const) {
      const res = await searchQuery(kw, sort);
      apiCalls += res.apiCalls;
      for (const it of res.items) {
        const title = stripHtml(it.title);
        const { ok } = titleFilter(title, cfg);
        const price = parseInt(it.lprice, 10);
        if (!ok || Number.isNaN(price) || price < COLLECT.minPrice) {
          rejected++;
          continue;
        }
        const pid = it.productId || it.link;
        const existing = byPid.get(pid);
        if (!existing || price < (existing._price ?? Infinity)) {
          byPid.set(pid, toRow(it, title, price, sku.sku_id, runId, kw));
        }
      }
    }
  }
  return { listings: [...byPid.values()], rejected, apiCalls };
}

function toRow(
  it: NaverItem,
  title: string,
  price: number,
  skuId: string,
  runId: string,
  query: string,
): NaverListingRow {
  return {
    source_sku_id: skuId,
    run_id: runId,
    query,
    title,
    lprice: price,
    hprice: it.hprice ? parseInt(it.hprice, 10) || null : null,
    mall_name: it.mallName ?? "",
    product_id: it.productId ?? "",
    product_type: it.productType ?? "",
    brand: it.brand ?? "",
    maker: it.maker ?? "",
    category1: it.category1 ?? null,
    category2: it.category2 ?? null,
    category3: it.category3 ?? null,
    category4: it.category4 ?? null,
    passed_filter: true,
    _price: price,
  };
}
