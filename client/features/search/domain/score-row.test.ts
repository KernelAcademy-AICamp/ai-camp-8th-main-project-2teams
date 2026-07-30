import { describe, expect, it } from "vitest";

import type { Goods } from "@/features/catalog/domain/goods";
import { EMPTY_INTENT, type QueryIntent } from "@/features/search/domain/query-intent";
import { scoreRow, styleScore } from "@/features/search/domain/score-row";

function goods(p: Partial<Goods>): Goods {
  return {
    goodsNo: "1",
    styleKey: "",
    title: "티셔츠",
    brand: "",
    category: "",
    gender: "",
    colors: [],
    patterns: [],
    materials: [],
    fits: [],
    sizes: [],
    sizeFree: false,
    sizeStd: [],
    price: 0,
    reviewCount: 0,
    reviewScore: 0,
    gallery: [],
    url: "",
    thumbnail: "",
    wearChars: {},
    sizeMeasures: [],
    ...p,
  };
}
function intent(p: Partial<QueryIntent>): QueryIntent {
  return {
    ...EMPTY_INTENT,
    ...p,
    style: { ...EMPTY_INTENT.style, ...(p.style ?? {}) },
  };
}

describe("styleScore", () => {
  it("색 겹치면 색 가중치(3)를 더한다", () => {
    const s = styleScore(
      goods({ colors: ["블랙"] }),
      intent({
        style: {
          colors: ["블랙"],
          patterns: [],
          materials: [],
          fits: [],
          keywords: [],
        },
      }),
    );
    expect(s).toBe(3);
  });
  it("셰이드 다중선택 중 하나만 겹쳐도 색 가점", () => {
    const s = styleScore(
      goods({ colors: ["스카이 블루"] }),
      intent({
        style: {
          colors: ["블루", "스카이 블루", "데님"],
          patterns: [],
          materials: [],
          fits: [],
          keywords: [],
        },
      }),
    );
    expect(s).toBe(3);
  });
  it("promote된 속성은 소프트 점수에서 제외한다", () => {
    const s = styleScore(
      goods({ colors: ["블랙"], fits: ["오버"] }),
      intent({
        style: {
          colors: ["블랙"],
          patterns: [],
          materials: [],
          fits: ["오버"],
          keywords: [],
        },
        promote: ["fits"],
      }),
    );
    expect(s).toBe(3); // colors 3만, fits는 하드라 제외
  });
  it("제목에 키워드 있으면 키워드 가중치(3)", () => {
    const s = styleScore(
      goods({ title: "빈티지 워싱 티" }),
      intent({
        style: {
          colors: [],
          patterns: [],
          materials: [],
          fits: [],
          keywords: ["빈티지"],
        },
      }),
    );
    expect(s).toBe(3);
  });
});

describe("scoreRow", () => {
  it("styleScore + reviewScore/5", () => {
    const s = scoreRow(
      goods({ colors: ["블랙"], reviewScore: 5 }),
      intent({
        style: {
          colors: ["블랙"],
          patterns: [],
          materials: [],
          fits: [],
          keywords: [],
        },
      }),
    );
    expect(s).toBeCloseTo(4); // 3 + 1
  });
});

describe("styleScore wearChars", () => {
  it("착용감 축이 하나라도 매칭되면 1회 가점", () => {
    const g = goods({ wearChars: { 촉감: "부드러움" } });
    const i = intent({
      wearChars: { ...EMPTY_INTENT.wearChars, 촉감: ["부드러움", "약간|부드러움"] },
    });
    expect(styleScore(g, i)).toBe(2);
  });

  it("여러 축이 매칭돼도 누적하지 않고 1회만(다축 과대계상 방지)", () => {
    const g = goods({ wearChars: { 촉감: "부드러움", 두께: "얇음", 계절: "여름" } });
    const i = intent({
      wearChars: {
        ...EMPTY_INTENT.wearChars,
        촉감: ["부드러움"],
        두께: ["얇음"],
        계절: ["여름"],
      },
    });
    expect(styleScore(g, i)).toBe(2); // 3축 매칭이지만 6이 아니라 2
  });

  it("불일치·미보유는 0점", () => {
    const g = goods({ wearChars: { 촉감: "보통" } });
    const i = intent({ wearChars: { ...EMPTY_INTENT.wearChars, 촉감: ["부드러움"] } });
    expect(styleScore(g, i)).toBe(0);
  });
});
