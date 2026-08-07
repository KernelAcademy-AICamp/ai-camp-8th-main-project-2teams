// resolve-semantic.test.ts
import { describe, expect, it } from "vitest";

import { parseLinkerProposal } from "./linker-proposal";
import { buildQueryFrame } from "./query-frame";
import { resolveSemantic } from "./resolve-semantic";

const Q = "검은색이나 하얀색 무늬가 있는 빨간색 티셔츠";
const frame = () => buildQueryFrame(Q);
const proposal = () => {
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
  return p;
};

describe("resolveSemantic", () => {
  it("핵심 쿼리를 단일 clause로 해소한다(바탕=레드, 프린트=블랙·화이트 anyOf)", () => {
    const g = resolveSemantic(frame(), proposal());
    expect(g).not.toBeNull();
    if (!g) throw new Error("expected non-null graph");
    const c = g.clauses[0];
    expect(c.base.map((x) => x.values).flat()).toEqual(["레드"]);
    expect(c.print[0].values.sort()).toEqual(["블랙", "화이트"]);
    expect(c.print[0].fieldOperatorRef).toBe("o01");
  });
  it("선언되지 않은 ref가 있으면 전체 무효(null)", () => {
    const p = proposal();
    p.clauses[0].base.refs = ["m99"];
    expect(resolveSemantic(frame(), p)).toBeNull();
  });
  it("같은 mention을 base와 print에 동시 배치하면 무효", () => {
    const p = proposal();
    p.clauses[0].base.refs = ["m01"]; // m01은 print에도 있음
    expect(resolveSemantic(frame(), p)).toBeNull();
  });
});

describe("resolveSemantic — external 분리", () => {
  const EQ = "노란색 신발에 어울리는 검정 무늬 하얀색 티셔츠";
  const eFrame = () => buildQueryFrame(EQ);
  // buildQueryFrame(EQ) 결과: m01=노란색(옐로우, 신발 맥락) m02=검정(블랙) m03=하얀색(화이트)
  const eProposal = (external: string[]) => {
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
      external,
      newMentions: [],
    });
    if (!p) throw new Error("fixture proposal 파싱 실패");
    return p;
  };

  it("external ref가 정상 분리되면 graph.external에 {surface,span}로 들어가고 clause에는 없다", () => {
    const g = resolveSemantic(eFrame(), eProposal(["m01"]));
    expect(g).not.toBeNull();
    if (!g) throw new Error("expected non-null graph");
    expect(g.external).toEqual([{ surface: "노란색", span: [0, 3] }]);
    const c = g.clauses[0];
    expect(c.base.map((x) => x.values).flat()).toEqual(["화이트"]);
    expect(c.print.map((x) => x.values).flat()).toEqual(["블랙"]);
  });

  it("external ref가 clause에도 들어가면(배타 위반) 전체 무효(null)", () => {
    // m02는 print.refs에도 있음
    const g = resolveSemantic(eFrame(), eProposal(["m02"]));
    expect(g).toBeNull();
  });

  it("선언되지 않은 external ref면 전체 무효(null)", () => {
    const g = resolveSemantic(eFrame(), eProposal(["m99"]));
    expect(g).toBeNull();
  });
});
