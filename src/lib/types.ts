// 공유 타입

export interface MyProduct {
  sku_id: string;
  name: string;
  spec: string | null;
  inch: number | null;
  purchase_price: number | null;
  current_price: number | null;
  category: string | null;
  min_margin: number;
  price_basis: "low" | "median";
  search_keywords: string[];
  active: boolean;
}

export interface NaverItem {
  title: string;
  link: string;
  image: string;
  lprice: string;
  hprice: string;
  mallName: string;
  productId: string;
  productType: string;
  brand: string;
  maker: string;
  category1?: string;
  category2?: string;
  category3?: string;
  category4?: string;
}

export interface NaverListingRow {
  source_sku_id: string;
  run_id: string;
  query: string;
  title: string;
  lprice: number | null;
  hprice: number | null;
  mall_name: string;
  product_id: string;
  image: string | null; // 썸네일 (삭제 전 상품 확인용)
  link: string | null; // 네이버 상품 페이지
  product_type: string;
  brand: string;
  maker: string;
  category1: string | null;
  category2: string | null;
  category3: string | null;
  category4: string | null;
  passed_filter: boolean;
  _price?: number; // 내부 계산용
  _confidence?: number;
  _match_method?: "regex" | "llm" | "none";
}

export interface PriceGapReportRow {
  sku_id: string;
  run_id: string;
  my_price: number | null;
  purchase_price: number | null;
  market_low: number | null;
  market_median: number | null;
  recommended_price: number | null;
  gap_pct: number | null;
  margin: number | null;
  margin_pct: number | null;
  margin_breach: boolean;
  price_drop_pct: number | null;
  sample_count: number;
  summary: string | null;
}
