-- 표본 검증용 미디어: 썸네일 이미지 + 네이버 상품 링크.
-- 삭제(차단) 전 어떤 상품인지 사이트 이동 없이 인라인으로 확인하기 위함.
alter table naver_listings add column if not exists image text;
alter table naver_listings add column if not exists link  text;
alter table naver_blocked_listings add column if not exists image text;
