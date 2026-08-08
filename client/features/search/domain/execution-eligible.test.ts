// execution-eligible.test.ts
import { describe, expect, it } from "vitest";

import { compileAtomic } from "./compile-atomic";
import { compileSemanticPlan } from "./compile-semantic-plan";
import { executionEligible } from "./execution-eligible";
import { buildQueryFrame } from "./query-frame";

// 핵심 supported 쿼리로 valid_graph를 만들어 eligibility를 검사.
function build(
  q: string,
  assignments: Parameters<typeof compileAtomic>[1]["assignments"],
  orGroups: Parameters<typeof compileAtomic>[1]["orGroups"] = [],
) {
  const r = compileAtomic(buildQueryFrame(q), { assignments, orGroups });
  if (!r.graph) throw new Error(`fixture graph 실패: ${r.errors.join(",")}`);
  return r.graph;
}

describe("executionEligible", () => {
  it("단일 clause·동일필드 OR·known canon·compileLoss0·전부 should → eligible", () => {
    const g = build(
      "검은색이나 하얀색 무늬가 있는 빨간색 티셔츠",
      [
        { mentionRef: "m01", target: "print" },
        { mentionRef: "m02", target: "print" },
        { mentionRef: "m03", target: "base" },
      ],
      [{ memberRefs: ["m01", "m02"], operatorRef: "o01" }],
    );
    const r = executionEligible(g, compileSemanticPlan(g));
    expect(r.eligible).toBe(true);
  });

  it("바탕색 단독도 eligible", () => {
    const g = build("검은색 티셔츠", [{ mentionRef: "m01", target: "base" }]);
    expect(executionEligible(g, compileSemanticPlan(g)).eligible).toBe(true);
  });

  it("placement가 있으면 ineligible", () => {
    // graph를 직접 조작: placement에 Cond 주입
    const g = build("검은색 티셔츠", [{ mentionRef: "m01", target: "base" }]);
    g.clauses[0].placement = [
      {
        values: ["앞"],
        valueProvenance: "deterministic",
        targetProvenance: "llm",
        groupProvenance: "llm",
        coverageProvenance: "soft_only",
        evidence: "앞",
        relationEvidenceRefs: [],
        sourceMentionRefs: [],
      },
    ];
    const r = executionEligible(g, compileSemanticPlan(g));
    expect(r).toEqual({ eligible: false, reason: "placement" });
  });

  it("unknown canon이면 ineligible", () => {
    const g = build("검은색 티셔츠", [{ mentionRef: "m01", target: "base" }]);
    g.clauses[0].base[0].values = ["형광연두"]; // canon 아님
    const r = executionEligible(g, compileSemanticPlan(g));
    expect(r).toEqual({ eligible: false, reason: "unknown_canon" });
  });

  it("productBaseColors(D7 경로)가 있으면 ineligible", () => {
    const g = build("검은색 티셔츠", [{ mentionRef: "m01", target: "base" }]);
    g.productBaseColors = g.clauses[0].base;
    expect(executionEligible(g, compileSemanticPlan(g)).reason).toBe(
      "product_base_colors",
    );
  });
});
