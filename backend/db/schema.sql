-- Supabase 대시보드 → SQL Editor 에 붙여넣고 실행.
create extension if not exists vector;  -- pgvector: 이번엔 켜두기만(임베딩 컬럼은 추출 단계에서 추가)

create table if not exists products (
  -- 식별/출처
  id                uuid primary key default gen_random_uuid(),
  source            text not null default 'naver_shopping',
  source_product_id text not null,
  mall_name         text,
  product_type      text,

  -- 네이버 원본
  title             text not null,
  link              text not null,
  image_url         text,
  lprice            int,
  hprice            int,
  brand             text,
  maker             text,
  category1         text,
  category2         text,
  category3         text,
  category4         text,
  raw               jsonb,

  -- 추출 속성(지금 NULL, 다른 담당자가 채움 — client Tee 타입과 1:1)
  base_color        text,
  print_color       text,
  print_position    text,
  graphic_type      text,
  fit               text,
  material          text,
  functional        text[] default '{}',
  sizes             text[] default '{}',

  -- 운영
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  unique (source, source_product_id)
);

create index if not exists products_color_idx on products (base_color, print_color);
create index if not exists products_lprice_idx on products (lprice);
