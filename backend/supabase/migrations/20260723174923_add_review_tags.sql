-- 리뷰 정보태그 컬럼 추가: 리뷰 분석으로 뽑은 검색용 태그를 상품 단위로 저장.
-- 값 = 한글 태그의 유니크 셋(예: {도톰함,정사이즈,운동복}). supabase db push 로 적용.
alter table products
  add column if not exists review_tags text[] default '{}';

-- 태그 포함 검색(review_tags @> '{도톰함}')용 GIN 인덱스
create index if not exists products_review_tags_idx on products using gin (review_tags);
