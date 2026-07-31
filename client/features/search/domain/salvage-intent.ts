// 제목 0건 구제(설계 v3.2 §4.4) — 순수 함수.
// LLM 파서가 환각한 스타일 하드필터(overlaps)가 사용자가 직접 친 제목 토큰(ground truth)을
// 전멸시키면, 스타일 하드필터·exclude를 제거한 intent로 1회 재시도한다.
// gender·sizeStd·priceMin/Max·brand·titleTokens·wearChars·sort·promote·style.keywords는 유지.
import type { QueryIntent } from "@/features/search/domain/query-intent";

// route가 재시도 가치를 판단하는 predicate — strip 대상(style 4배열 + exclude 전체)이
// 하나라도 비어있지 않으면 true.
export function hasStyleHardFilters(intent: QueryIntent): boolean {
  const { colors, patterns, materials, fits } = intent.style;
  const {
    colors: ec,
    patterns: ep,
    materials: em,
    fits: ef,
    keywords: ek,
  } = intent.exclude;
  return (
    colors.length > 0 ||
    patterns.length > 0 ||
    materials.length > 0 ||
    fits.length > 0 ||
    ec.length > 0 ||
    ep.length > 0 ||
    em.length > 0 ||
    ef.length > 0 ||
    ek.length > 0
  );
}

// style의 colors/patterns/materials/fits와 exclude 전체를 비운 intent를 반환한다.
export function stripStyleHardFilters(intent: QueryIntent): QueryIntent {
  return {
    ...intent,
    style: {
      ...intent.style,
      colors: [],
      patterns: [],
      materials: [],
      fits: [],
    },
    exclude: {
      colors: [],
      patterns: [],
      materials: [],
      fits: [],
      keywords: [],
    },
  };
}

// titleTokens를 뺀 나머지로도 조회할 가치가 있는지 — brand·gender·sizeStd·priceMin/Max·
// style 4배열(colors/patterns/materials/fits)·exclude(4배열+keywords) 중 하나라도 있으면 true.
// ⚠️ hasStyleHardFilters와 별개 함수: keywords(소프트)·wearChars(소프트)는 여기서 신호로 치지 않는다.
export function hasNonTitleHardFilters(intent: QueryIntent): boolean {
  const { colors, patterns, materials, fits } = intent.style;
  const {
    colors: ec,
    patterns: ep,
    materials: em,
    fits: ef,
    keywords: ek,
  } = intent.exclude;
  return (
    Boolean(intent.brand) ||
    Boolean(intent.gender) ||
    intent.sizeStd.length > 0 ||
    intent.priceMin != null ||
    intent.priceMax != null ||
    colors.length > 0 ||
    patterns.length > 0 ||
    materials.length > 0 ||
    fits.length > 0 ||
    ec.length > 0 ||
    ep.length > 0 ||
    em.length > 0 ||
    ef.length > 0 ||
    ek.length > 0
  );
}
