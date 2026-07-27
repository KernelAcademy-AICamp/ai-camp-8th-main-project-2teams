-- 리뷰 정보태그(review_tags)를 하이브리드 검색에 반영한다.
-- ⚠️ 선행 의존: 20260723174923_add_review_tags.sql (products.review_tags text[] 컬럼).
--    → 그 마이그레이션이 먼저 적용돼야 한다(PR #27). 없으면 이 함수 생성이 실패한다.
--
-- 두 가지를 구현한다(클라 fallback searchTees와 동일 규칙):
--  1) 제외 필터(반대말): intent.excludeTags(결함/기피 태그)를 하나라도 가진 상품은 결과에서 제외.
--  2) 태그 합치기(겹침): 원하는 태그 = functional ∪ reviewTags, 상품 태그풀 = functional ∪ review_tags.
--     겹치는 태그(냉감·통풍·흡습속건)는 어느 컬럼에 있든 한 번만 세어 동일하게 가점된다.
-- 반환에 review_tags를 추가(UI 표기·디버깅용).

-- RETURNS TABLE 컬럼이 바뀌므로(오버로드 아님) 기존 시그니처를 먼저 제거해야 한다.
drop function if exists search_products(vector(1024), jsonb, text[], int, float, float, float);

create or replace function search_products(
  query_embedding vector(1024),
  intent jsonb default '{}'::jsonb,
  keywords text[] default '{}',
  match_limit int default 60,
  w_sem float default 0.5,
  w_lex float default 0.4,
  w_attr float default 0.1
)
returns table (
  id uuid, title text, brand text, maker text, mall_name text,
  lprice int, link text, image_url text, gender text,
  base_color text, print_color text[], print_position text,
  graphic_type text, fit text, material text,
  functional text[], review_tags text[], sizes text[], brand_canonical text, score float
)
language sql stable as $$
  with
  -- 원하는 태그 = functional ∪ reviewTags (중복 제거). 겹치는 태그를 하나로 합친다.
  wanted as (
    select distinct elem
    from jsonb_array_elements_text(
      coalesce(intent->'functional', '[]'::jsonb) || coalesce(intent->'reviewTags', '[]'::jsonb)
    ) elem
  ),
  -- 제외 태그(반대말) 배열. 비면 '{}'.
  excl as (
    select coalesce(array_agg(elem), '{}'::text[]) as tags
    from jsonb_array_elements_text(coalesce(intent->'excludeTags', '[]'::jsonb)) elem
  ),
  cand as (
    select p.*, b.canonical as brand_canonical,
           1 - (p.embedding <=> query_embedding) as sem,
           coalesce(
             (select count(*) from unnest(keywords) kw where p.title ilike '%' || kw || '%')::float
             / nullif(array_length(keywords, 1), 0), 0) as lex
    from products p
    left join brands b on b.id = p.brand_id
    where p.embedding is not null
      -- 하드 필터: 공용 제외 요청이면 정확 성별만
      and (
        coalesce((intent->>'genderExclusive')::boolean, false) = false
        or p.gender = (intent->>'gender')
      )
      -- 하드 필터: 기피 태그를 하나라도 가진 상품은 제외(배열 교집합)
      and not (coalesce(p.review_tags, '{}'::text[]) && (select tags from excl))
  ),
  scored as (
    select c.*,
      (
        (case when intent->>'brand' is not null and c.brand_canonical = intent->>'brand' then 2 else 0 end)
      + (case when intent->>'gender' is not null and (c.gender = intent->>'gender' or c.gender = 'unisex') then 2 else 0 end)
      + (case when intent->>'baseColor' is not null and c.base_color = intent->>'baseColor' then 2 else 0 end)
      + (case when intent->>'printColor' is not null and intent->>'printColor' = any(c.print_color) then 2 else 0 end)
      + (case when intent->>'printPosition' is not null and (c.print_position = intent->>'printPosition' or c.print_position = '양면') then 1 else 0 end)
      + (case when intent->>'fit' is not null and c.fit = intent->>'fit' then 1 else 0 end)
      + (case when intent->>'graphicType' is not null and c.graphic_type = intent->>'graphicType' then 1 else 0 end)
      -- 태그 가점: 원하는 태그가 상품 태그풀(functional ∪ review_tags)에 있으면 +1씩
      + coalesce((select count(*) from wanted w
                  where w.elem = any(c.functional)
                     or w.elem = any(coalesce(c.review_tags, '{}'::text[]))), 0)
      )::float as raw_boost,
      nullif(
        (case when intent->>'brand' is not null then 2 else 0 end)
      + (case when intent->>'gender' is not null then 2 else 0 end)
      + (case when intent->>'baseColor' is not null then 2 else 0 end)
      + (case when intent->>'printColor' is not null then 2 else 0 end)
      + (case when intent->>'printPosition' is not null then 1 else 0 end)
      + (case when intent->>'fit' is not null then 1 else 0 end)
      + (case when intent->>'graphicType' is not null then 1 else 0 end)
      + coalesce((select count(*) from wanted), 0)
      , 0)::float as max_boost
    from cand c
  )
  select id, title, brand, maker, mall_name, lprice, link, image_url, gender,
         base_color, print_color, print_position, graphic_type, fit, material,
         functional, review_tags, sizes, brand_canonical,
         (w_sem * sem + w_lex * lex + w_attr * coalesce(raw_boost / max_boost, 0)) as score
  from scored
  order by score desc
  limit match_limit;
$$;
