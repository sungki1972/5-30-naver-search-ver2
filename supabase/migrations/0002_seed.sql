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
