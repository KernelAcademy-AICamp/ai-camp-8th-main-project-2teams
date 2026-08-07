// 소유권 미리보기(설계 §3⑦·§13) — Shadow1은 계산만, 실제 평면 제거는 하지 않는다.
import type { QueryFrame } from "./query-frame";
import type { ResolvedSemanticGraph } from "./semantic-graph";

export function ownershipPreview(
  frame: QueryFrame,
  g: ResolvedSemanticGraph,
): { claimedSpans: [number, number][]; suppressedFlatAxes: string[] } {
  // 결속에 쓰인 캐논값 → 해당 mention span 수집
  const usedValues = new Set<string>();
  for (const c of g.clauses) {
    for (const f of [c.base, c.print, c.placement, c.graphic]) {
      for (const cond of f) for (const v of cond.values) usedValues.add(v);
    }
  }
  const claimedSpans: [number, number][] = frame.mentions
    .filter((m) => m.canon !== undefined && usedValues.has(m.canon))
    .map((m) => m.span);
  const axes = new Set<string>();
  if (g.clauses.some((c) => c.base.length || c.print.length)) axes.add("colors");
  if (g.clauses.some((c) => c.graphic.length)) axes.add("patterns");
  return { claimedSpans, suppressedFlatAxes: [...axes] };
}
