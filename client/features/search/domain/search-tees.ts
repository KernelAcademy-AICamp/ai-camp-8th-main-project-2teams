// 유스케이스: 의도(Intent)로 상품 필터 + 매칭 점수 랭킹. 순수 함수.
// 모든 조건 충족(miss=0)이면 exact, 일부만 충족이면 partial로 분류한다.
import type { Tee } from "@/features/catalog/domain/tee";
import type { Intent } from "@/features/search/domain/intent";

export interface SearchResult {
  exact: Tee[];
  partial: Tee[];
}

export function searchTees(tees: Tee[], intent: Intent): SearchResult {
  const excludeTags = intent.excludeTags ?? [];
  // 원하는 태그 = 기능(냉감·통풍·신축·흡습속건) + 리뷰 긍정태그 합집합(중복 제거).
  const wantedTags = [...new Set([...intent.functional, ...(intent.reviewTags ?? [])])];

  const gained =
    intent.baseColor !== undefined ||
    intent.printColor !== undefined ||
    intent.printPosition !== undefined ||
    intent.fit !== undefined ||
    intent.graphicType !== undefined ||
    intent.brand !== undefined ||
    intent.gender !== undefined ||
    wantedTags.length > 0;

  if (!gained && excludeTags.length === 0) return { exact: tees, partial: [] };

  // 부정 태그 = 제외 필터. 리뷰에서 결함이 보고된 상품(예: 비침있음)은 후보에서 뺀다.
  const candidates = excludeTags.length
    ? tees.filter((t) => !excludeTags.some((neg) => t.reviewTags.includes(neg)))
    : tees;

  // 제외 조건만 있고 가점 조건이 없으면, 걸러낸 나머지를 전부 exact로 반환.
  if (!gained) return { exact: candidates, partial: [] };

  const scored = candidates.map((t) => {
    let score = 0;
    let miss = 0;
    const bump = (cond: boolean, w = 1) => (cond ? (score += w) : (miss += 1));
    // 상품 태그 풀 = 기능 + 리뷰태그 합집합.
    const tagPool = new Set([...t.functional, ...t.reviewTags]);

    if (intent.brand) bump(t.brandCanonical === intent.brand, 2);
    if (intent.gender)
      bump(
        intent.genderExclusive
          ? t.gender === intent.gender // 공용 제외: 정확 성별만
          : t.gender === "unisex" || t.gender === intent.gender, // 방향성: 공용 포함
        2,
      );
    if (intent.baseColor) bump(t.baseColor === intent.baseColor, 2);
    if (intent.printColor) bump(t.printColor === intent.printColor, 2);
    if (intent.printPosition)
      bump(t.printPosition === intent.printPosition || t.printPosition === "양면");
    if (intent.fit) bump(t.fit === intent.fit);
    if (intent.graphicType) bump(t.graphicType === intent.graphicType);
    for (const tag of wantedTags) bump(tagPool.has(tag), 2);

    return { t, score, miss };
  });

  const matched = scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.miss - b.miss);

  return {
    exact: matched.filter((s) => s.miss === 0).map((s) => s.t),
    partial: matched.filter((s) => s.miss > 0).map((s) => s.t),
  };
}
