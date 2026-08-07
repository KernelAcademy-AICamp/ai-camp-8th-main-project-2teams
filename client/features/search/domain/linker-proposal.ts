// LLM Relation Linker의 출력 계약(설계 §4.2). 서버는 이 값을 신뢰하지 않고 검증(Task3)한다.
export interface FieldGroup {
  refs: string[]; // knownRef(mXX) | uRef(uXX)
  operator: "single" | "anyOf";
  operatorRef?: string; // 필드 내부 OR('이나') 근거 — refs 2개↑면 필수
}
export interface ProposalClause {
  base: FieldGroup;
  print: FieldGroup;
  placement: FieldGroup;
  graphic: FieldGroup;
  anchorRefs: string[];
  objectKind?: string;
}
export interface ProposalAlternative {
  clauseIndexes: number[];
  operatorRef?: string; // top-level OR 근거
}
export interface LinkerProposal {
  clauses: ProposalClause[];
  alternatives: ProposalAlternative[];
  external: string[];
  newMentions: {
    localId: string;
    kind: string;
    evidence: string;
    anchorEvidence?: string;
    candidateHints?: string[];
  }[];
}

function rec(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : null;
}

function parseField(v: unknown): FieldGroup | null {
  const r = rec(v);
  if (!r || !Array.isArray(r.refs)) return null;
  const refs = r.refs.filter((x): x is string => typeof x === "string");
  if (refs.length !== r.refs.length) return null;
  const operator =
    r.operator === "anyOf" ? "anyOf" : r.operator === "single" ? "single" : null;
  if (!operator) return null;
  const operatorRef = typeof r.operatorRef === "string" ? r.operatorRef : undefined;
  if (refs.length >= 2 && operator === "anyOf" && !operatorRef) return null; // OR 근거 필수
  if (refs.length >= 2 && operator !== "anyOf") return null;
  return { refs, operator, operatorRef };
}

export function parseLinkerProposal(raw: unknown): LinkerProposal | null {
  const r = rec(raw);
  if (!r || !Array.isArray(r.clauses) || !Array.isArray(r.alternatives)) return null;
  const clauses: ProposalClause[] = [];
  for (const c of r.clauses) {
    const cr = rec(c);
    if (!cr || !Array.isArray(cr.anchorRefs)) return null;
    const base = parseField(cr.base);
    const print = parseField(cr.print);
    const placement = parseField(cr.placement);
    const graphic = parseField(cr.graphic);
    if (!base || !print || !placement || !graphic) return null;
    clauses.push({
      base,
      print,
      placement,
      graphic,
      anchorRefs: cr.anchorRefs.filter((x): x is string => typeof x === "string"),
      objectKind: typeof cr.objectKind === "string" ? cr.objectKind : undefined,
    });
  }
  const alternatives: ProposalAlternative[] = [];
  for (const a of r.alternatives) {
    const ar = rec(a);
    if (!ar || !Array.isArray(ar.clauseIndexes)) return null;
    alternatives.push({
      clauseIndexes: ar.clauseIndexes.filter((x): x is number => typeof x === "number"),
      operatorRef: typeof ar.operatorRef === "string" ? ar.operatorRef : undefined,
    });
  }
  const external = Array.isArray(r.external)
    ? r.external.filter((x): x is string => typeof x === "string")
    : [];
  return { clauses, alternatives, external, newMentions: [] }; // Shadow1: newMentions 미지원
}
