// LinkerProposal + QueryFrame → 검증(§4)·해소(§3⑤) → ResolvedSemanticGraph.
// 구조 참조 오류 하나면 전체 무효(부분 제거·OR 갈래 삭제 금지).
import type { FieldGroup, LinkerProposal } from "./linker-proposal";
import type { FrameMention, QueryFrame } from "./query-frame";
import type { Cond, ResolvedClause, ResolvedSemanticGraph } from "./semantic-graph";

function mentionById(frame: QueryFrame): Map<string, FrameMention> {
  return new Map(frame.mentions.map((m) => [m.id, m]));
}

function resolveField(
  field: FieldGroup,
  byId: Map<string, FrameMention>,
  usedMentionIds: Set<string>,
): Cond[] | null {
  if (field.refs.length === 0) return [];
  const values: string[] = [];
  const evidences: string[] = [];
  for (const ref of field.refs) {
    const m = byId.get(ref);
    if (m?.canon === undefined) return null; // 선언 안 됨·캐논 없음 → 무효
    if (usedMentionIds.has(ref)) return null; // 동일 mention 중복 배치 → 무효
    usedMentionIds.add(ref);
    values.push(m.canon);
    evidences.push(m.surface);
  }
  return [
    {
      values,
      fieldOperatorRef: field.operatorRef,
      valueProvenance: "deterministic", // 색 캐논은 결정적
      targetProvenance: "llm", // 대상 귀속은 LLM
      groupProvenance: "llm", // 결속은 LLM
      coverageProvenance: "soft_only", // Shadow1: 커버리지 미측정 → soft
      evidence: evidences.join(","),
      relationEvidenceRefs: field.operatorRef ? [field.operatorRef] : [],
    },
  ];
}

export function resolveSemantic(
  frame: QueryFrame,
  proposal: LinkerProposal,
): ResolvedSemanticGraph | null {
  if (proposal.newMentions.length > 0) return null; // Shadow1 미지원
  if (proposal.clauses.length !== 1) return null; // Shadow1: 단일 clause
  const byId = mentionById(frame);
  const used = new Set<string>();
  const pc = proposal.clauses[0];

  const base = resolveField(pc.base, byId, used);
  const print = resolveField(pc.print, byId, used);
  const placement = resolveField(pc.placement, byId, used);
  const graphic = resolveField(pc.graphic, byId, used);
  if (!base || !print || !placement || !graphic) return null;

  // operatorRef가 실제 operator를 가리키는지
  const opIds = new Set(frame.operators.map((o) => o.id));
  for (const g of [base, print, placement, graphic]) {
    for (const c of g) {
      if (c.fieldOperatorRef && !opIds.has(c.fieldOperatorRef)) return null;
    }
  }

  const clause: ResolvedClause = {
    id: "c1",
    base,
    print,
    placement,
    graphic,
    objectKind: "any_object",
    existence: "independent",
  };
  return {
    clauses: [clause],
    alternatives: [["c1"]],
    productBaseColors: [], // Shadow1: 결속 clause가 있으므로 상품수준 이관 없음
    external: [],
    unresolved: [],
    graphHash: "", // Task4에서 채움
  };
}
