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

  it("같은 mention을 external로 중복 지정하면 무효", () => {
    expect(resolveSemantic(eFrame(), eProposal(["m01", "m01"]))).toBeNull();
  });

  it("모든 mention을 external로 몰아 실행 필드가 전부 비면(빈 clause) 무효", () => {
    // clause 필드는 전부 비우고 m01,m02,m03을 전부 external로
    const p = parseLinkerProposal({
      clauses: [
        {
          base: { refs: [], operator: "single" },
          print: { refs: [], operator: "single" },
          placement: { refs: [], operator: "single" },
          graphic: { refs: [], operator: "single" },
          anchorRefs: ["a01"],
        },
      ],
      alternatives: [{ clauseIndexes: [0] }],
      external: ["m01", "m02", "m03"],
      newMentions: [],
    });
    if (!p) throw new Error("fixture proposal 파싱 실패");
    expect(resolveSemantic(eFrame(), p)).toBeNull();
  });
});

describe("resolveSemantic — §7 검증 강화(안전장치)", () => {
  // 색 mention을 누락하면(어디에도 귀속 안 됨) 완전성 위반 → 전체 무효
  it("완전성: mention을 clause·external 어디에도 두지 않으면 무효(누락 탐지)", () => {
    const p = proposal();
    p.clauses[0].print.refs = ["m01"]; // m02(하얀색)를 print에서 뺌 → 어디에도 없음
    p.clauses[0].print.operator = "single";
    p.clauses[0].print.operatorRef = undefined;
    expect(resolveSemantic(frame(), p)).toBeNull();
  });

  it("anchorRef가 프레임에 없으면 무효(환각 anchor 탐지)", () => {
    const p = proposal();
    p.clauses[0].anchorRefs = ["a99"];
    expect(resolveSemantic(frame(), p)).toBeNull();
  });

  it("alternatives.clauseIndexes가 범위를 벗어나면 무효(환각 인덱스 탐지)", () => {
    const p = proposal();
    p.alternatives = [{ clauseIndexes: [99] }];
    expect(resolveSemantic(frame(), p)).toBeNull();
  });

  it("alternatives가 비어 있으면 무효(무손실 위반)", () => {
    const p = proposal();
    p.alternatives = [];
    expect(resolveSemantic(frame(), p)).toBeNull();
  });

  it("alternatives.clauseIndexes가 빈 배열이면 무효", () => {
    const p = proposal();
    p.alternatives = [{ clauseIndexes: [] }];
    expect(resolveSemantic(frame(), p)).toBeNull();
  });

  it("단일 clause에 top-level operatorRef가 붙으면 무효(유령 top-level OR)", () => {
    const p = proposal();
    p.alternatives = [{ clauseIndexes: [0], operatorRef: "o01" }];
    expect(resolveSemantic(frame(), p)).toBeNull();
  });

  it("anchorRef를 중복 참조하면 무효", () => {
    const p = proposal();
    p.clauses[0].anchorRefs = ["a01", "a01"];
    expect(resolveSemantic(frame(), p)).toBeNull();
  });
});

describe("resolveSemantic — operator occurrence 완전성", () => {
  // "빨간색이나 파란색 티셔츠": o01(이나), m01=빨간색, m02=파란색
  const OQ = "빨간색이나 파란색 티셔츠";
  it("프레임 operator를 하나도 참조하지 않으면 무효(접속 구조 무시)", () => {
    const f = buildQueryFrame(OQ);
    // m01만 바탕으로, m02는 external로 몰아 o01을 아무도 쓰지 않게 만든 제안
    const p = parseLinkerProposal({
      clauses: [
        {
          base: { refs: ["m01"], operator: "single" },
          print: { refs: [], operator: "single" },
          placement: { refs: [], operator: "single" },
          graphic: { refs: [], operator: "single" },
          anchorRefs: ["a01"],
        },
      ],
      alternatives: [{ clauseIndexes: [0] }],
      external: ["m02"],
      newMentions: [],
    });
    if (!p) throw new Error("fixture proposal 파싱 실패");
    expect(resolveSemantic(f, p)).toBeNull();
  });
});

describe("resolveSemantic — field↔kind(역귀속 차단)", () => {
  const GQ = "블랙 로고 티셔츠"; // m01=블랙(color), m02=로고(graphic)
  const gFrame = () => buildQueryFrame(GQ);
  const mkProposal = (base: string[], graphic: string[]) => {
    const p = parseLinkerProposal({
      clauses: [
        {
          base: { refs: base, operator: "single" },
          print: { refs: [], operator: "single" },
          placement: { refs: [], operator: "single" },
          graphic: { refs: graphic, operator: "single" },
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

  it("바탕=블랙(color), 그래픽=로고(graphic)는 정상 해소", () => {
    const g = resolveSemantic(gFrame(), mkProposal(["m01"], ["m02"]));
    expect(g).not.toBeNull();
    if (!g) throw new Error("expected non-null");
    expect(g.clauses[0].base.flatMap((c) => c.values)).toEqual(["블랙"]);
    expect(g.clauses[0].graphic.flatMap((c) => c.values)).toEqual(["로고"]);
  });

  it("역귀속(바탕=로고 graphic-kind, 그래픽=블랙 color-kind)이면 무효", () => {
    expect(resolveSemantic(gFrame(), mkProposal(["m02"], ["m01"]))).toBeNull();
  });
});
