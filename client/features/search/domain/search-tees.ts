// 유스케이스: 의도(Intent)로 상품 필터 + 매칭 점수 랭킹. 순수 함수.
// 모든 조건 충족(miss=0)이면 exact, 일부만 충족이면 partial로 분류한다.
import type { Tee } from "@/features/catalog/domain/tee";
import type { Intent } from "@/features/search/domain/intent";

export interface SearchResult {
  exact: Tee[];
  partial: Tee[];
}

export function searchTees(tees: Tee[], intent: Intent): SearchResult {
  const anyConstraint =
    intent.baseColor !== undefined ||
    intent.printColor !== undefined ||
    intent.printPosition !== undefined ||
    intent.fit !== undefined ||
    intent.graphicType !== undefined ||
    intent.brand !== undefined ||
    intent.functional.length > 0;

  if (!anyConstraint) return { exact: tees, partial: [] };

  const scored = tees.map((t) => {
    let score = 0;
    let miss = 0;
    const bump = (cond: boolean, w = 1) => (cond ? (score += w) : (miss += 1));

    if (intent.brand) bump(t.brandCanonical === intent.brand, 2);
    if (intent.baseColor) bump(t.baseColor === intent.baseColor, 2);
    if (intent.printColor) bump(t.printColor === intent.printColor, 2);
    if (intent.printPosition)
      bump(t.printPosition === intent.printPosition || t.printPosition === "양면");
    if (intent.fit) bump(t.fit === intent.fit);
    if (intent.graphicType) bump(t.graphicType === intent.graphicType);
    for (const fn of intent.functional) bump(t.functional.includes(fn));

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
