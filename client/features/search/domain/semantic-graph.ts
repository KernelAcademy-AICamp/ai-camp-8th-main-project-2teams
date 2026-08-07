// 검증·해소 후 서버 소유 IR(설계 §4.3). canonicalize/hash는 Task4에서 추가.
export type Provenance = "deterministic" | "promoted" | "llm";
export interface Cond {
  values: string[];
  fieldOperatorRef?: string;
  valueProvenance: Provenance;
  targetProvenance: "deterministic" | "llm";
  groupProvenance: "deterministic" | "llm";
  coverageProvenance: "hard_eligible" | "soft_only";
  evidence: string;
  relationEvidenceRefs: string[];
}
export interface ResolvedClause {
  id: string;
  base: Cond[];
  print: Cond[];
  placement: Cond[];
  graphic: Cond[];
  objectKind: string;
  existence: "distinct" | "independent";
}
export interface ResolvedSemanticGraph {
  clauses: ResolvedClause[];
  alternatives: string[][];
  productBaseColors: Cond[];
  external: { surface: string; span: [number, number] }[];
  unresolved: [number, number][];
  graphHash: string;
}
