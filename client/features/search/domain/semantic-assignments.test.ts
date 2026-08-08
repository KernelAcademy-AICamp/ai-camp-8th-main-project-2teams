// semantic-assignments.test.ts
import { describe, expect, it } from "vitest";

import { parseLinkerProposal } from "./linker-proposal";
import { buildQueryFrame } from "./query-frame";
import { deriveRawAssignments } from "./semantic-assignments";

const Q = "검은색이나 하얀색 무늬가 있는 빨간색 티셔츠"; // m01검은색 m02하얀색 m03빨간색

function proposal(base: string[], print: string[], external: string[] = []) {
  const p = parseLinkerProposal({
    clauses: [
      {
        base: {
          refs: base,
          operator: base.length >= 2 ? "anyOf" : "single",
          ...(base.length >= 2 ? { operatorRef: "o01" } : {}),
        },
        print: {
          refs: print,
          operator: print.length >= 2 ? "anyOf" : "single",
          ...(print.length >= 2 ? { operatorRef: "o01" } : {}),
        },
        placement: { refs: [], operator: "single" },
        graphic: { refs: [], operator: "single" },
        anchorRefs: ["a01"],
      },
    ],
    alternatives: [{ clauseIndexes: [0] }],
    external,
    newMentions: [],
  });
  if (!p) throw new Error("fixture 파싱 실패");
  return p;
}

describe("deriveRawAssignments", () => {
  it("정귀속: 빨간색=base, 검은/하얀=print", () => {
    const a = deriveRawAssignments(
      buildQueryFrame(Q),
      proposal(["m03"], ["m01", "m02"]),
    );
    const t = new Map(a.map((x) => [x.canon, x.target]));
    expect(t.get("레드")).toBe("base");
    expect(t.get("블랙")).toBe("print");
    expect(t.get("화이트")).toBe("print");
  });

  it("역귀속도 그대로 관측한다(검증과 무관): 빨간색=print, 검은/하얀=base", () => {
    const a = deriveRawAssignments(
      buildQueryFrame(Q),
      proposal(["m01", "m02"], ["m03"]),
    );
    const t = new Map(a.map((x) => [x.canon, x.target]));
    expect(t.get("레드")).toBe("print");
    expect(t.get("블랙")).toBe("base");
  });

  it("external·미귀속을 구분한다", () => {
    // m03만 base, m01 external, m02 미귀속
    const a = deriveRawAssignments(buildQueryFrame(Q), proposal(["m03"], [], ["m01"]));
    const t = new Map(a.map((x) => [x.canon, x.target]));
    expect(t.get("레드")).toBe("base");
    expect(t.get("블랙")).toBe("external");
    expect(t.get("화이트")).toBe("unassigned");
  });
});
