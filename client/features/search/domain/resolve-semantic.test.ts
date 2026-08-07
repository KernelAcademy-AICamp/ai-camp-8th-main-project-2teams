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
