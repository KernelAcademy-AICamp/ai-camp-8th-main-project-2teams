import { describe, expect, it } from "vitest";

import { parseLinkerProposal } from "./linker-proposal";

const VALID = {
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
};

describe("parseLinkerProposal", () => {
  it("유효한 제안을 파싱한다", () => {
    const p = parseLinkerProposal(VALID);
    expect(p?.clauses[0].print).toEqual({
      refs: ["m01", "m02"],
      operator: "anyOf",
      operatorRef: "o01",
    });
  });
  it("anyOf인데 operatorRef 없으면 null(무효)", () => {
    const bad = structuredClone(VALID);
    delete (bad.clauses[0].print as { operatorRef?: string }).operatorRef;
    expect(parseLinkerProposal(bad)).toBeNull();
  });
  it("깨진 구조(배열 아님·필드 누락)는 null", () => {
    expect(parseLinkerProposal(null)).toBeNull();
    expect(parseLinkerProposal({ clauses: "x" })).toBeNull();
  });
  it("alternatives.clauseIndexes에 타입 안 맞는 원소가 섞이면 조용히 드롭하지 않고 null", () => {
    const bad = structuredClone(VALID);
    bad.alternatives = [{ clauseIndexes: [0, "x"] as unknown as number[] }];
    expect(parseLinkerProposal(bad)).toBeNull();
  });
  it("anyOf인데 refs가 1개뿐이면 null(무효)", () => {
    const bad = structuredClone(VALID);
    bad.clauses[0].print = { refs: ["m01"], operator: "anyOf", operatorRef: "o01" };
    expect(parseLinkerProposal(bad)).toBeNull();
  });
  it("single인데 operatorRef가 있으면 null(유령 근거 금지)", () => {
    const bad = structuredClone(VALID);
    bad.clauses[0].base = {
      refs: ["m01"],
      operator: "single",
      operatorRef: "o99",
    } as unknown as (typeof bad.clauses)[0]["base"];
    expect(parseLinkerProposal(bad)).toBeNull();
  });
});
