-- 네이버 가격 정찰 시세 인텔리전스 — 초기 스키마 (테이블명 naver_ 접두어)
-- 6 테이블 + UNIQUE 제약(멱등성) + RLS(anon 차단, service_role 전용)

-- 1. 내 취급 품목 (매입가 기준)
create table if not exists naver_my_products (
  sku_id           text primary key,
  name             text not null,
  spec             text,
  inch             numeric,
  purchase_price   integer,
  current_price    integer,
  category         text,
  min_margin       numeric not null default 0.12,
  price_basis      text not null default 'median' check (price_basis in ('low','median')),
  search_keywords  text[] not null default '{}',
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- 2. 네이버 수집 원시 리스팅
create table if not exists naver_listings (
  id             bigint generated always as identity primary key,
  source_sku_id  text references naver_my_products(sku_id) on delete set null,  -- 검색 origin (매칭 아님)
  run_id         text not null,
  query          text not null,
  title          text not null,
  lprice         integer,
  hprice         integer,
  mall_name      text,
  product_id     text,
  product_type   text,
  brand          text,
  maker          text,
  category1      text, category2 text, category3 text, category4 text,
  passed_filter  boolean not null default false,
  collected_at   timestamptz not null default now(),
  unique (run_id, source_sku_id, product_id)
);
create index if not exists idx_naver_listings_run on naver_listings(run_id);
create index if not exists idx_naver_listings_sku on naver_listings(source_sku_id);

-- 3. 매칭 결과
create table if not exists naver_product_matches (
  id           bigint generated always as identity primary key,
  sku_id       text not null references naver_my_products(sku_id) on delete cascade,
  listing_id   bigint references naver_listings(id) on delete cascade,
  match_method text not null check (match_method in ('regex','llm','none')),
  confidence   numeric not null default 0,
  status       text,
  run_id       text not null,
  created_at   timestamptz not null default now(),
  unique (run_id, sku_id, listing_id)
);
create index if not exists idx_naver_matches_run_sku on naver_product_matches(run_id, sku_id);

-- 4. 시세 스냅샷 (시계열)
create table if not exists naver_price_snapshots (
  id             bigint generated always as identity primary key,
  sku_id         text not null references naver_my_products(sku_id) on delete cascade,
  run_id         text not null,
  date           date not null default current_date,
  market_low     integer,
  market_median  integer,
  market_high    integer,
  sample_count   integer not null default 0,
  my_price       integer,
  created_at     timestamptz not null default now(),
  unique (run_id, sku_id)
);
create index if not exists idx_naver_snapshots_sku_date on naver_price_snapshots(sku_id, date);

-- 5. 격차 리포트 (주산출물)
create table if not exists naver_price_gap_reports (
  id                bigint generated always as identity primary key,
  sku_id            text not null references naver_my_products(sku_id) on delete cascade,
  run_id            text not null,
  my_price          integer,
  purchase_price    integer,
  market_low        integer,
  market_median     integer,
  recommended_price integer,
  gap_pct           numeric,
  margin            integer,
  margin_pct        numeric,
  margin_breach     boolean not null default false,
  price_drop_pct    numeric,
  sample_count      integer not null default 0,
  summary           text,
  created_at        timestamptz not null default now(),
  unique (run_id, sku_id)
);
create index if not exists idx_naver_reports_run on naver_price_gap_reports(run_id);

-- 6. 실행 로그 (멱등성/관측성)
create table if not exists naver_run_logs (
  run_id        text primary key,        -- YYYYMMDD-HHmmss
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  sku_count     integer not null default 0,
  chunk_total   integer not null default 0,
  chunk_done    integer not null default 0,
  api_calls     integer not null default 0,
  matched_count integer not null default 0,
  error_count   integer not null default 0,
  status        text not null default 'running' check (status in ('running','partial','done','failed'))
);

-- RLS: 모든 테이블 anon 차단. service_role은 RLS 우회.
alter table naver_my_products       enable row level security;
alter table naver_listings          enable row level security;
alter table naver_product_matches   enable row level security;
alter table naver_price_snapshots   enable row level security;
alter table naver_price_gap_reports enable row level security;
alter table naver_run_logs          enable row level security;
-- ver1 (build_pricelist.py ROWS, naver_lowest.json) 기반 초기 시드.
-- 매입가(purchase_price)는 사용자가 실제 값으로 채워야 함 (현재는 추정 placeholder).
-- 현재판매가(current_price)는 ver1 B안(인기중앙값+15% 천원올림) 채택.

insert into naver_my_products
  (sku_id, name, spec, inch, purchase_price, current_price, category, min_margin, price_basis, search_keywords, active)
values
  ('LDS-D-13', 'LDS 매입등 다운라이트 3인치 6W',  '타공 75mm · LDS-D-13 호환 · 플리커프리 · 3색', 3, 3200, 7000, 'LED매입등', 0.12, 'median',
    array['LDS 매입등 3인치','LDS 다운라이트 3인치','비츠온 LDS 3인치','리더스 LDS 3인치','LDS 75파이 매입등'], true),
  ('LDS-D-12', 'LDS 매입등 다운라이트 4인치 8W',  '타공 100mm · LDS-D-12 호환 · 플리커프리 · 3색', 4, 3200, 7000, 'LED매입등', 0.12, 'median',
    array['LDS 매입등 4인치','LDS 다운라이트 4인치','비츠온 LDS 4인치','리더스 LDS 4인치','LDS 100파이 매입등'], true),
  ('LDS-D-11', 'LDS 매입등 다운라이트 5인치 12W', '타공 125mm · LDS-D-11 호환 · 플리커프리 · 3색', 5, 4000, 7000, 'LED매입등', 0.12, 'median',
    array['LDS 매입등 5인치','LDS 다운라이트 5인치','비츠온 LDS 5인치','리더스 LDS 5인치','LDS 125파이 매입등'], true),
  ('LDS-D-10', 'LDS 매입등 다운라이트 6인치 16W', '타공 150mm · LDS-D-10 호환 · 플리커프리 · 3색', 6, 4200, 10000, 'LED매입등', 0.12, 'median',
    array['LDS 매입등 6인치','LDS 다운라이트 6인치','비츠온 LDS 6인치','리더스 LDS 6인치','LDS 150파이 매입등'], true)
on conflict (sku_id) do update set
  name = excluded.name, spec = excluded.spec, inch = excluded.inch,
  current_price = excluded.current_price, search_keywords = excluded.search_keywords,
  updated_at = now();
