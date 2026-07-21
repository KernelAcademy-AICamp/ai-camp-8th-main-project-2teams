// 유스케이스: 의도(Intent)로 상품 필터 + 매칭 점수 랭킹. 순수 함수.
import type { Intent } from "@/lib/domain/intent";
import type { Tee } from "@/lib/domain/tee";

export function searchTees(tees: Tee[], intent: Intent): Tee[] {
  const anyConstraint =
    intent.baseColor !== undefined ||
    intent.printColor !== undefined ||
    intent.printPosition !== undefined ||
    intent.fit !== undefined ||
    intent.graphicType !== undefined ||
    intent.functional.length > 0;

  if (!anyConstraint) return tees;

  const scored = tees.map((t) => {
    let score = 0;
    let miss = 0;
    const bump = (cond: boolean, w = 1) => (cond ? (score += w) : (miss += 1));

    if (intent.baseColor) bump(t.baseColor === intent.baseColor, 2);
    if (intent.printColor) bump(t.printColor === intent.printColor, 2);
    if (intent.printPosition)
      bump(t.printPosition === intent.printPosition || t.printPosition === "양면");
    if (intent.fit) bump(t.fit === intent.fit);
    if (intent.graphicType) bump(t.graphicType === intent.graphicType);
    for (const fn of intent.functional) bump(t.functional.includes(fn));

    return { t, score, miss };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.miss - b.miss)
    .map((s) => s.t);
}
