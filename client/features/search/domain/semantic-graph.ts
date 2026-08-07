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

function fnv1a32(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export const COMPILER_VERSION = "semantic-compiler@v1";

export function canonicalizeGraph(
  g: ResolvedSemanticGraph,
  inventoryHash: string,
): string {
  const norm = {
    clauses: g.clauses.map((c) => ({
      base: c.base.map((x) => [...x.values].sort()),
      print: c.print.map((x) => [...x.values].sort()),
      placement: c.placement.map((x) => [...x.values].sort()),
      graphic: c.graphic.map((x) => [...x.values].sort()),
      objectKind: c.objectKind,
      existence: c.existence,
    })),
    alternatives: g.alternatives,
    productBaseColors: g.productBaseColors.map((x) => [...x.values].sort()),
    inventoryHash,
    compiler: COMPILER_VERSION,
  };
  return `sg@${fnv1a32(JSON.stringify(norm))}`;
}
