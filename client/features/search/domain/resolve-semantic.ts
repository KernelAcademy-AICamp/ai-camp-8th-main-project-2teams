// LinkerProposal + QueryFrame → 검증(§4)·해소(§3⑤) → ResolvedSemanticGraph.
// 구조 참조 오류 하나면 전체 무효(부분 제거·OR 갈래 삭제 금지).
import type { FieldGroup, LinkerProposal } from "./linker-proposal";
import type { FrameMention, MentionKind, QueryFrame } from "./query-frame";
import type { Cond, ResolvedClause, ResolvedSemanticGraph } from "./semantic-graph";
import { canonicalizeGraph } from "./semantic-graph";

function mentionById(frame: QueryFrame): Map<string, FrameMention> {
  return new Map(frame.mentions.map((m) => [m.id, m]));
}

function resolveField(
  field: FieldGroup,
  byId: Map<string, FrameMention>,
  usedMentionIds: Set<string>,
  allowedKinds: ReadonlySet<MentionKind>,
): Cond[] | null {
  if (field.refs.length === 0) return [];
  const values: string[] = [];
  const evidences: string[] = [];
  const sourceMentionRefs: string[] = [];
  for (const ref of field.refs) {
    const m = byId.get(ref);
    if (m?.canon === undefined) return null; // 선언 안 됨·캐논 없음 → 무효
    if (!allowedKinds.has(m.kind)) return null; // field↔mention kind 불일치(역귀속) → 무효
    if (usedMentionIds.has(ref)) return null; // 동일 mention 중복 배치 → 무효
    usedMentionIds.add(ref);
    values.push(m.canon);
    evidences.push(m.surface);
    sourceMentionRefs.push(ref);
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
      sourceMentionRefs,
    },
  ];
}

// 필드별 허용 mention kind(§13 field↔kind). placement는 mention kind가 없으므로 어떤
// mention ref도 올 수 없다(위치는 anchor에서 온다) → 비어있어야 정상.
const COLOR_ONLY: ReadonlySet<MentionKind> = new Set(["color"]);
const GRAPHIC_ONLY: ReadonlySet<MentionKind> = new Set(["graphic"]);
const NO_MENTION: ReadonlySet<MentionKind> = new Set();

export function resolveSemantic(
  frame: QueryFrame,
  proposal: LinkerProposal,
): ResolvedSemanticGraph | null {
  if (proposal.newMentions.length > 0) return null; // Shadow1 미지원
  if (proposal.clauses.length !== 1) return null; // Shadow1: 단일 clause
  const byId = mentionById(frame);
  const used = new Set<string>();
  const pc = proposal.clauses[0];

  // anchorRefs가 프레임에 실존 + 중복 없이(환각·중복 anchor 탐지)
  const anchorIds = new Set(frame.anchors.map((a) => a.id));
  const seenAnchors = new Set<string>();
  for (const ar of pc.anchorRefs) {
    if (!anchorIds.has(ar)) return null;
    if (seenAnchors.has(ar)) return null; // 같은 anchor를 두 번 참조 → 무효
    seenAnchors.add(ar);
  }

  // alternatives 구조 검증(Shadow1은 단일 clause). 유효한 형태는 정확히 하나:
  // clause 0만 덮는 단일 alternative, top-level operator 없음. 그 외(빈 배열·빈 인덱스·
  // 범위 밖·중복 clause·단일 clause에 유령 top-level OR)는 관계가 조용히 사라지므로 전부 무효.
  if (proposal.alternatives.length !== 1) return null;
  const alt = proposal.alternatives[0];
  if (alt.operatorRef !== undefined) return null; // 단일 clause엔 top-level OR가 성립 안 함
  if (alt.clauseIndexes.length !== 1 || alt.clauseIndexes[0] !== 0) return null;

  const base = resolveField(pc.base, byId, used, COLOR_ONLY);
  const print = resolveField(pc.print, byId, used, COLOR_ONLY);
  const placement = resolveField(pc.placement, byId, used, NO_MENTION);
  const graphic = resolveField(pc.graphic, byId, used, GRAPHIC_ONLY);
  if (!base || !print || !placement || !graphic) return null;

  // operatorRef 검증: 실존 + 정확히 한 relation에만 사용(필드 OR + top-level OR 통틀어 유일).
  const opIds = new Set(frame.operators.map((o) => o.id));
  const opUsed = new Set<string>();
  const opRefs = [
    ...[base, print, placement, graphic].flat().map((c) => c.fieldOperatorRef),
    ...proposal.alternatives.map((a) => a.operatorRef),
  ];
  for (const opRef of opRefs) {
    if (opRef === undefined) continue;
    if (!opIds.has(opRef)) return null; // 유령 operator 참조
    if (opUsed.has(opRef)) return null; // 같은 operator를 두 relation이 사용 → 무효
    opUsed.add(opRef);
  }
  // operator occurrence 완전성: 프레임의 모든 operator가 정확히 한 번 소비돼야 한다.
  // 하나라도 아무 relation에 안 쓰이면 LLM이 접속 구조를 무시한 것 → 후보 전체 무효.
  if (opUsed.size !== frame.operators.length) return null;

  // external(외부 맥락 mention) 분리: 선언 안 됨·중복·clause와 겹침(배타 위반) → 무효
  const external: { surface: string; span: [number, number] }[] = [];
  const externalRefs = new Set<string>();
  for (const ref of proposal.external) {
    const m = byId.get(ref);
    if (!m) return null; // 선언 안 된 ref → 무효
    if (used.has(ref)) return null; // clause에서 이미 쓴 mention을 external로도 지정 → 배타 위반
    if (externalRefs.has(ref)) return null; // 같은 mention을 external로 두 번 → 무효
    externalRefs.add(ref);
    external.push({ surface: m.surface, span: m.span });
  }

  // 완전성(§13): 모든 mention은 clause(used) 또는 external 중 하나에 귀속돼야 한다.
  // 하나라도 어디에도 없으면 LLM이 표현을 누락한 것 → 후보 전체 무효.
  for (const m of frame.mentions) {
    if (!used.has(m.id) && !externalRefs.has(m.id)) return null;
  }

  // 빈 clause 방지: 실행 필드가 전부 비면(모든 색을 external로 몰아넣은 경우 등) 결속할
  // 대상이 없으므로 무효 — 관측에 의미 없는 빈 plan을 남기지 않는다.
  if (
    base.length === 0 &&
    print.length === 0 &&
    placement.length === 0 &&
    graphic.length === 0
  ) {
    return null;
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
  const graph: ResolvedSemanticGraph = {
    clauses: [clause],
    alternatives: [["c1"]],
    productBaseColors: [], // Shadow1: 결속 clause가 있으므로 상품수준 이관 없음
    external,
    unresolved: [],
    graphHash: "",
  };
  const inventoryHash = JSON.stringify(frame.mentions.map((m) => [m.id, m.canon]));
  graph.graphHash = canonicalizeGraph(graph, inventoryHash);
  return graph;
}
