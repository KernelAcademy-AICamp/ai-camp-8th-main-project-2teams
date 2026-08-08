-- 리뷰 정보태그 컬럼: 리뷰 분석으로 뽑은 검색용 태그를 상품 단위로 저장.
-- 값 = 한글 태그 유니크 셋. 상태 3종: NULL=미분석 / {unknown}=분석했으나 태그없음 / {태그}=있음.
-- 기본값 없음 → 새 상품은 NULL(미분석). supabase db push 로 적용.
alter table products
  add column if not exists review_tags text[];

-- 태그 포함 검색(review_tags @> '{도톰함}')용 GIN 인덱스
create index if not exists products_review_tags_idx on products using gin (review_tags);
