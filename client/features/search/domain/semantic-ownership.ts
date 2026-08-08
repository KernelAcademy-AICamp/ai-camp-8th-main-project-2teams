// 소유권 미리보기(설계 §3⑦·§13) — Shadow1은 계산만, 실제 평면 제거는 하지 않는다.
import type { QueryFrame } from "./query-frame";
import type { ResolvedSemanticGraph } from "./semantic-graph";

export function ownershipPreview(
  frame: QueryFrame,
  g: ResolvedSemanticGraph,
): { claimedSpans: [number, number][]; suppressedFlatAxes: string[] } {
  // 결속에 실제로 쓰인 mention id → 그 mention의 span만 claimed.
  // 캐논값으로 역검색하면 같은 색을 가진 external mention(예: "검정 신발")까지 잘못 소비한다.
  const usedRefs = new Set<string>();
  for (const c of g.clauses) {
    for (const f of [c.base, c.print, c.placement, c.graphic]) {
      for (const cond of f) for (const r of cond.sourceMentionRefs) usedRefs.add(r);
    }
  }
  const claimedSpans: [number, number][] = frame.mentions
    .filter((m) => usedRefs.has(m.id))
    .map((m) => m.span);
  const axes = new Set<string>();
  if (g.clauses.some((c) => c.base.length || c.print.length)) axes.add("colors");
  if (g.clauses.some((c) => c.graphic.length)) axes.add("patterns");
  return { claimedSpans, suppressedFlatAxes: [...axes] };
}
