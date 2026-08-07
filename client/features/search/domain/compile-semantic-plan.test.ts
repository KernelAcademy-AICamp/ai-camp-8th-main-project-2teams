import { describe, expect, it } from "vitest";

import { compileSemanticPlan } from "./compile-semantic-plan";
import { parseLinkerProposal } from "./linker-proposal";
import { buildQueryFrame } from "./query-frame";
import { resolveSemantic } from "./resolve-semantic";
import type { ResolvedSemanticGraph } from "./semantic-graph";

const graph = () => {
  const f = buildQueryFrame("검은색이나 하얀색 무늬가 있는 빨간색 티셔츠");
  const p = parseLinkerProposal({
    clauses: [
      {
        base: { refs: ["m03"], operator: "single" },
        print: { refs: ["m01", "m02"], operator: "anyOf", operatorRef: "o01" },
        placement: { refs: [], operator: "single" },
        graphic: { refs: [], operator: "single" },
        anchorRefs: ["a01"],
      },
    ],
    alternatives: [{ clauseIndexes: [0] }],
    external: [],
    newMentions: [],
  });
  if (!p) throw new Error("fixture proposal 파싱 실패");
  const g = resolveSemantic(f, p);
  if (!g) throw new Error("fixture graph 해소 실패");
  return g;
};

describe("compileSemanticPlan", () => {
  it("바탕=레드 AND 프린트 IN(블랙,화이트) 단일 clause로 컴파일", () => {
    const r = compileSemanticPlan(graph());
    expect(r.printClauses).toHaveLength(1);
    expect(r.printClauses[0].baseColors).toEqual(["레드"]);
    expect(r.printClauses[0].printColors.sort()).toEqual(["블랙", "화이트"]);
    expect(r.compileLoss).toBe(0);
  });
  it("결속이 LLM 출처면 enforcement는 should(§5 최약 provenance)", () => {
    const r = compileSemanticPlan(graph());
    expect(r.printClauses[0].enforcement.printColors).toBe("should");
    expect(r.printClauses[0].enforcement.baseColors).toBe("should");
  });
  it("모든 provenance가 결정적+hard_eligible이면 enforcement는 must(§5 계약 확인)", () => {
    // 모든 조건이 결정적/승격이고 coverageProvenance가 hard_eligible인 합성 그래프
    const syntheticGraph: ResolvedSemanticGraph = {
      clauses: [
        {
          id: "test-clause-1",
          base: [
            {
              values: ["블랙"],
              valueProvenance: "deterministic",
              targetProvenance: "deterministic",
              groupProvenance: "deterministic",
              coverageProvenance: "hard_eligible",
              evidence: "블랙",
              relationEvidenceRefs: [],
            },
          ],
          print: [],
          placement: [],
          graphic: [],
          objectKind: "base_color",
          existence: "distinct",
        },
      ],
      alternatives: [],
      productBaseColors: [],
      external: [],
      unresolved: [],
      graphHash: "test-hash",
    };

    const r = compileSemanticPlan(syntheticGraph);
    expect(r.printClauses[0].enforcement.baseColors).toBe("must");

    // 대비군: groupProvenance만 llm으로 바꾸면 should
    const shouldGraph: ResolvedSemanticGraph = {
      ...syntheticGraph,
      clauses: [
        {
          ...syntheticGraph.clauses[0],
          base: [
            {
              values: ["블랙"],
              valueProvenance: "deterministic",
              targetProvenance: "deterministic",
              groupProvenance: "llm", // 유일한 차이
              coverageProvenance: "hard_eligible",
              evidence: "블랙",
              relationEvidenceRefs: [],
            },
          ],
        },
      ],
    };
    const rShould = compileSemanticPlan(shouldGraph);
    expect(rShould.printClauses[0].enforcement.baseColors).toBe("should");
  });
});
