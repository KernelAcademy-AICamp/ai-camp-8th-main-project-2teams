// 링커 raw 제안의 '색/그래픽 mention별 target 귀속'을 검증 성패와 무관하게 뽑는다.
// 목적: shadow에서 base/print 역전 등 의미 오류를 관측·측정하기 위함(검증이 통째 거부해
// null이 되면 accepted_wrong을 못 보는 문제 해결 — 부분 관측 허용, 부분 수용은 금지).
import type { LinkerProposal } from "./linker-proposal";
import type { QueryFrame } from "./query-frame";

export type AssignmentTarget =
  "base" | "print" | "placement" | "graphic" | "external" | "unassigned";

export interface RawAssignment {
  mentionRef: string;
  surface: string;
  canon?: string;
  target: AssignmentTarget;
}

/**
 * frame의 색/그래픽 mention 각각이 proposal의 단일 clause에서 어느 필드(또는 external)에
 * 놓였는지 판정한다. Shadow1은 단일 clause 전제이므로 clauses[0]만 본다.
 * 검증(resolveSemantic) 통과 여부와 무관하게 계산한다(관측 전용).
 */
export function deriveRawAssignments(
  frame: QueryFrame,
  proposal: LinkerProposal,
): RawAssignment[] {
  const clause = proposal.clauses.length > 0 ? proposal.clauses[0] : undefined;
  const external = new Set(proposal.external);
  const inField = (refs: string[], id: string): boolean => refs.includes(id);

  return frame.mentions.map((m) => {
    let target: AssignmentTarget = "unassigned";
    if (clause) {
      if (inField(clause.base.refs, m.id)) target = "base";
      else if (inField(clause.print.refs, m.id)) target = "print";
      else if (inField(clause.placement.refs, m.id)) target = "placement";
      else if (inField(clause.graphic.refs, m.id)) target = "graphic";
    }
    if (target === "unassigned" && external.has(m.id)) target = "external";
    return { mentionRef: m.id, surface: m.surface, canon: m.canon, target };
  });
}
