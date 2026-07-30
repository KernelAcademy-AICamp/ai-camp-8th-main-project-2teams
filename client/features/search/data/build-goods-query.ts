// QueryIntent → search_goods 하드 필터 쿼리. 소프트 랭킹은 rank-goods가 앱단에서 처리.
// GoodsQuery는 @supabase/supabase-js PostgrestFilterBuilder가 구조적으로 만족한다.
import type { QueryIntent } from "@/features/search/domain/query-intent";

export interface GoodsQuery {
  eq(column: string, value: unknown): GoodsQuery;
  or(filters: string): GoodsQuery;
  gte(column: string, value: unknown): GoodsQuery;
  lte(column: string, value: unknown): GoodsQuery;
  overlaps(column: string, value: readonly unknown[]): GoodsQuery;
  not(column: string, operator: string, value: unknown): GoodsQuery;
  order(column: string, options: { ascending: boolean }): GoodsQuery;
  limit(count: number): GoodsQuery;
}

// PostgREST 배열 리터럴 — 값을 큰따옴표로 감싸 공백·슬래시 안전. 예: {"블랙","스카이 블루"}
export function pgArray(values: string[]): string {
  return `{${values.map((v) => `"${v.replace(/"/g, '\\"')}"`).join(",")}}`;
}

const EXCLUDE_ARRAY_KEYS = ["colors", "patterns", "materials", "fits"] as const;

export function buildGoodsQuery<T extends GoodsQuery>(base: T, intent: QueryIntent): T {
  let q: GoodsQuery = base;

  if (intent.gender) q = q.eq("gender", intent.gender);
  if (intent.sizeStd.length) {
    // size_std 겹치거나 프리사이즈면 통과
    q = q.or(`size_std.ov.{${intent.sizeStd.join(",")}},size_free.eq.true`);
  }
  if (intent.priceMin != null) q = q.gte("price", intent.priceMin);
  if (intent.priceMax != null) q = q.lte("price", intent.priceMax);

  // (A) promote된 스타일 → 하드(overlaps: 선택값 중 하나라도 보유). keywords는 소프트 유지.
  for (const key of intent.promote) {
    if (key === "keywords") continue;
    const vals = intent.style[key];
    if (vals.length) q = q.overlaps(key, vals);
  }

  // (C) exclude → NOT
  for (const key of EXCLUDE_ARRAY_KEYS) {
    const vals = intent.exclude[key];
    if (vals.length) q = q.not(key, "ov", pgArray(vals));
  }
  for (const kw of intent.exclude.keywords) {
    q = q.not("title", "ilike", `%${kw}%`);
  }

  // 안전 백스톱 — 리뷰순 정렬 후 현재 코퍼스(2,472)를 덮는 상한으로 자른다.
  // soft 속성(색·wear 등)은 랭킹 전에 배제하지 않도록 후보를 넓게 확보한다.
  q = q.order("review_score", { ascending: false }).limit(3000);
  return q as T;
}
