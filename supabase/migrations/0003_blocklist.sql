-- 잘못된 크롤링 표본 영구 차단 목록.
-- 사용자가 격차 리포트 > 품목 상세에서 표본을 삭제하면 (sku_id, product_id)가 여기 기록되고,
-- 이후 모든 스캔의 수집 단계에서 해당 네이버 상품을 건너뛴다.
create table if not exists naver_blocked_listings (
  id          bigint generated always as identity primary key,
  sku_id      text not null references naver_my_products(sku_id) on delete cascade,
  product_id  text not null,           -- 네이버 productId (없으면 link)
  title       text,                    -- 참고용 (차단 당시 제목)
  mall_name   text,
  lprice      integer,
  blocked_at  timestamptz not null default now(),
  unique (sku_id, product_id)
);
create index if not exists idx_naver_blocked_sku on naver_blocked_listings(sku_id);
alter table naver_blocked_listings enable row level security;
