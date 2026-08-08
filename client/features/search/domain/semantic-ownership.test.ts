// semantic-ownership.test.ts
import { describe, expect, it } from "vitest";

import { parseLinkerProposal } from "./linker-proposal";
import { buildQueryFrame } from "./query-frame";
import { resolveSemantic } from "./resolve-semantic";
import { ownershipPreview } from "./semantic-ownership";

describe("ownershipPreview", () => {
  it("결속에 쓰인 색 span을 claimed로, colors 축을 suppressed로 보고한다(미적용, 미리보기만)", () => {
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
    if (!g) throw new Error("expected non-null graph");
    const o = ownershipPreview(f, g);
    expect(o.claimedSpans.length).toBe(3); // m01,m02,m03
    expect(o.suppressedFlatAxes).toContain("colors");
  });

  it("같은 색이 external과 clause에 각각 있으면 external span은 claimed에서 제외(정확한 mention 기준)", () => {
    const f = buildQueryFrame("검정 신발 검정 무늬 하얀색 티셔츠");
    // m01=검정(신발 맥락→external), m02=검정(무늬→print), m03=하얀색(바탕)
    const p = parseLinkerProposal({
      clauses: [
        {
          base: { refs: ["m03"], operator: "single" },
          print: { refs: ["m02"], operator: "single" },
          placement: { refs: [], operator: "single" },
          graphic: { refs: [], operator: "single" },
          anchorRefs: ["a01"],
        },
      ],
      alternatives: [{ clauseIndexes: [0] }],
      external: ["m01"],
      newMentions: [],
    });
    if (!p) throw new Error("fixture proposal 파싱 실패");
    const g = resolveSemantic(f, p);
    if (!g) throw new Error("expected non-null graph");
    const m01 = f.mentions.find((m) => m.id === "m01");
    if (!m01) throw new Error("m01 없음");
    const o = ownershipPreview(f, g);
    expect(o.claimedSpans).toHaveLength(2); // m02, m03만 — external 검정(m01)은 제외
    expect(o.claimedSpans).not.toContainEqual(m01.span);
  });
});
