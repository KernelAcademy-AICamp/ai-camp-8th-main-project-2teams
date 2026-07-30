// 소프트 랭킹 점수 — 순수함수. promote 안 된 스타일 속성 매칭 + review 타이브레이크.
import type { Goods } from "@/features/catalog/domain/goods";
import type { QueryIntent, StyleFilter } from "@/features/search/domain/query-intent";

export const WEIGHTS = {
  colors: 3,
  patterns: 2,
  materials: 2,
  fits: 2,
  keyword: 3,
} as const;

const ARRAY_KEYS = ["colors", "patterns", "materials", "fits"] as const;

function overlaps(a: readonly string[], b: readonly string[]): boolean {
  return a.some((x) => b.includes(x));
}

// review 제외한 순수 스타일 매칭 점수. promote된 키는 하드필터라 채점 제외.
export function styleScore(goods: Goods, intent: QueryIntent): number {
  let s = 0;
  for (const key of ARRAY_KEYS) {
    if (intent.promote.includes(key)) continue;
    const wanted = intent.style[key];
    if (wanted.length && overlaps(goods[key], wanted)) {
      s += WEIGHTS[key];
    }
  }
  const keywords: StyleFilter["keywords"] = intent.style.keywords;
  for (const kw of keywords) {
    if (goods.title.includes(kw)) s += WEIGHTS.keyword;
  }
  return s;
}

export function scoreRow(goods: Goods, intent: QueryIntent): number {
  return styleScore(goods, intent) + goods.reviewScore / 5;
}
