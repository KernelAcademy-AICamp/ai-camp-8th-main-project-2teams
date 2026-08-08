// AtomicProposal + QueryFrame → 검증·해소 → ResolvedSemanticGraph (설계 §3④⑤ atomic판).
// resolve-semantic(nested)의 무손실 계약을 atomic 형태로 이식한다:
//  - 모든 mention이 정확히 한 번 disposition(완전성)
//  - field↔kind(base/print=color, graphic=graphic, placement=mention 불가)
//  - 참조 실존(unknown ref·anchor·operator 하나면 전체 무효)
//  - operator 실존·유일성·occurrence 완전성
//  - 빈 clause 금지
//  - unresolved가 하나라도 있으면 valid_abstain(완전한 disposition이나 실행 부적격)
import type { AtomicProposal, AtomicTarget } from "./atomic-proposal";
import type { FrameMention, MentionKind, QueryFrame } from "./query-frame";
import type { Cond, ResolvedClause, ResolvedSemanticGraph } from "./semantic-graph";
import { canonicalizeGraph } from "./semantic-graph";

export type AtomicDisposition = "valid_graph" | "valid_abstain" | "validation_error";

export interface CompileAtomicResult {
  disposition: AtomicDisposition;
  graph?: ResolvedSemanticGraph;
  errors: string[];
}

const KIND_OF_FIELD: Record<"base" | "print" | "graphic", MentionKind> = {
  base: "color",
  print: "color",
  graphic: "graphic",
};

function fail(errors: string[]): CompileAtomicResult {
  return { disposition: "validation_error", errors };
}

export function compileAtomic(
  frame: QueryFrame,
  proposal: AtomicProposal,
): CompileAtomicResult {
  const errors: string[] = [];
  const byId = new Map<string, FrameMention>(frame.mentions.map((m) => [m.id, m]));
  const anchorIds = new Set(frame.anchors.map((a) => a.id));
  const opIds = new Set(frame.operators.map((o) => o.id));

  // 1) assignment 참조 실존·중복·완전성 + field↔kind
  const seen = new Set<string>();
  const targetOf = new Map<string, AtomicTarget>();
  for (const a of proposal.assignments) {
    const m = byId.get(a.mentionRef);
    if (!m) return fail(["unknown_mention_ref"]);
    if (seen.has(a.mentionRef)) return fail(["duplicate_assignment"]);
    seen.add(a.mentionRef);
    targetOf.set(a.mentionRef, a.target);
    if (a.target === "base" || a.target === "print" || a.target === "graphic") {
      if (m.kind !== KIND_OF_FIELD[a.target]) return fail(["field_kind_mismatch"]);
    } else if (a.target === "placement") {
      return fail(["placement_mention_unsupported"]); // placement mention kind 없음
    }
    if (a.targetAnchorRef !== undefined && !anchorIds.has(a.targetAnchorRef))
      return fail(["unknown_anchor_ref"]);
  }
  // 완전성: 모든 frame mention이 정확히 한 번 귀속돼야 한다.
  for (const m of frame.mentions)
    if (!seen.has(m.id)) return fail(["incomplete_mention"]);

  // 2) orGroup 검증: 멤버 실존·동일 필드·2개↑·operator 실존/유일
  const memberToGroup = new Map<string, string>(); // mentionRef → operatorRef
  const opUsed = new Set<string>();
  for (const g of proposal.orGroups) {
    if (g.memberRefs.length < 2) return fail(["orgroup_too_small"]);
    if (!opIds.has(g.operatorRef)) return fail(["orgroup_unknown_operator"]);
    if (opUsed.has(g.operatorRef)) return fail(["operator_reused"]);
    opUsed.add(g.operatorRef);
    let field: AtomicTarget | undefined;
    for (const ref of g.memberRefs) {
      if (!seen.has(ref)) return fail(["orgroup_unknown_member"]);
      if (memberToGroup.has(ref)) return fail(["member_in_multiple_groups"]);
      memberToGroup.set(ref, g.operatorRef);
      const t = targetOf.get(ref);
      if (field === undefined) field = t;
      else if (field !== t) return fail(["orgroup_mixed_field"]);
    }
  }
  // operator occurrence 완전성: 프레임 operator가 전부 소비돼야 한다.
  if (opUsed.size !== frame.operators.length) return fail(["operator_not_consumed"]);

  // 3) 필드별 Cond 조립
  const field = (name: "base" | "print" | "placement" | "graphic"): Cond[] => {
    const members = proposal.assignments.filter((a) => a.target === name);
    if (members.length === 0) return [];
    // 같은 필드 멤버가 하나의 orGroup으로 묶였는지(2개↑면 반드시 OR 근거 필요)
    const opRefs = new Set(
      members
        .map((a) => memberToGroup.get(a.mentionRef))
        .filter((x) => x !== undefined),
    );
    if (members.length >= 2 && opRefs.size === 0) return []; // OR 근거 없는 다중 → 아래서 무효 처리
    const values: string[] = [];
    const refs: string[] = [];
    const evid: string[] = [];
    for (const a of members) {
      const m = byId.get(a.mentionRef);
      if (m?.canon === undefined) continue;
      values.push(m.canon);
      refs.push(a.mentionRef);
      evid.push(m.surface);
    }
    const operatorRef = opRefs.size === 1 ? [...opRefs][0] : undefined;
    return [
      {
        values,
        fieldOperatorRef: operatorRef,
        valueProvenance: "deterministic",
        targetProvenance: "llm",
        groupProvenance: "llm",
        coverageProvenance: "soft_only",
        evidence: evid.join(","),
        relationEvidenceRefs: operatorRef ? [operatorRef] : [],
        sourceMentionRefs: refs,
      },
    ];
  };
  // OR 근거 없는 다중 필드 탐지(base/print/graphic 각각)
  for (const name of ["base", "print", "graphic"] as const) {
    const members = proposal.assignments.filter((a) => a.target === name);
    const opRefs = new Set(
      members
        .map((a) => memberToGroup.get(a.mentionRef))
        .filter((x) => x !== undefined),
    );
    if (members.length >= 2 && opRefs.size === 0)
      return fail(["field_multi_without_or"]);
  }

  const base = field("base");
  const print = field("print");
  const placement = field("placement");
  const graphic = field("graphic");

  const external = proposal.assignments
    .filter((a) => a.target === "external")
    .map((a) => {
      const m = byId.get(a.mentionRef);
      return m ? { surface: m.surface, span: m.span } : null;
    })
    .filter((x): x is { surface: string; span: [number, number] } => x !== null);

  const hasUnresolved = proposal.assignments.some((a) => a.target === "unresolved");

  // 빈 clause 방지(모두 external/unresolved인 경우 등)
  const clauseEmpty =
    base.length === 0 &&
    print.length === 0 &&
    placement.length === 0 &&
    graphic.length === 0;

  // unresolved가 있으면 valid_abstain(완전 disposition·실행 부적격). 단 구조 오류는 위에서 이미 걸러짐.
  if (hasUnresolved) return { disposition: "valid_abstain", errors: [] };
  if (clauseEmpty) return fail(["empty_clause"]);

  const clause: ResolvedClause = {
    id: "c1",
    base,
    print,
    placement,
    graphic,
    objectKind: "any_object",
    existence: "independent",
  };
  const graph: ResolvedSemanticGraph = {
    clauses: [clause],
    alternatives: [["c1"]],
    productBaseColors: [],
    external,
    unresolved: [],
    graphHash: "",
  };
  const inventoryHash = JSON.stringify(frame.mentions.map((m) => [m.id, m.canon]));
  graph.graphHash = canonicalizeGraph(graph, inventoryHash);
  return { disposition: "valid_graph", graph, errors };
}
