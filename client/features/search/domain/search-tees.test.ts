import { describe, expect, it } from "vitest";

import type { Tee } from "@/features/catalog/domain/tee";
import type { Intent } from "@/features/search/domain/intent";
import { searchTees } from "@/features/search/domain/search-tees";

function tee(over: Partial<Tee> & { id: string }): Tee {
  return {
    name: "t",
    brand: "b",
    price: 10000,
    mall: "m",
    link: "http://x",
    gender: "unisex",
    functional: [],
    reviewTags: [],
    sizes: [],
    ...over,
  };
}

const EMPTY: Intent = { functional: [] };

describe("searchTees", () => {
  it("조건이 없으면 전체를 exact로 반환한다", () => {
    const tees = [tee({ id: "a" }), tee({ id: "b" })];
    const r = searchTees(tees, EMPTY);
    expect(r.exact.map((t) => t.id)).toEqual(["a", "b"]);
    expect(r.partial).toEqual([]);
  });

  it("모든 조건을 충족하면 exact로 분류한다", () => {
    const tees = [tee({ id: "a", baseColor: "흰", fit: "오버" })];
    const r = searchTees(tees, { ...EMPTY, baseColor: "흰", fit: "오버" });
    expect(r.exact.map((t) => t.id)).toEqual(["a"]);
    expect(r.partial).toEqual([]);
  });

  it("일부만 충족하면 partial로 분류한다", () => {
    const tees = [tee({ id: "a", baseColor: "흰", fit: "슬림" })];
    const r = searchTees(tees, { ...EMPTY, baseColor: "흰", fit: "오버" });
    expect(r.exact).toEqual([]);
    expect(r.partial.map((t) => t.id)).toEqual(["a"]);
  });

  it("아무 조건도 안 맞으면 어느 쪽에도 없다", () => {
    const tees = [tee({ id: "a", baseColor: "검정" })];
    const r = searchTees(tees, { ...EMPTY, baseColor: "흰" });
    expect(r.exact).toEqual([]);
    expect(r.partial).toEqual([]);
  });

  it("양면 프린팅은 앞/뒤 위치 요청에 매칭된다", () => {
    const tees = [tee({ id: "a", printPosition: "양면" })];
    const r = searchTees(tees, { ...EMPTY, printPosition: "뒤" });
    expect(r.exact.map((t) => t.id)).toEqual(["a"]);
  });

  it("점수 높은 순으로 정렬한다", () => {
    const tees = [
      tee({ id: "low", baseColor: "흰" }),
      tee({ id: "high", baseColor: "흰", printColor: "검정" }),
    ];
    const r = searchTees(tees, { ...EMPTY, baseColor: "흰", printColor: "검정" });
    expect(r.exact[0]?.id).toBe("high");
  });

  it("브랜드가 일치하면 exact, 불일치면 partial(다른 조건 있을 때)", () => {
    const tees = [
      tee({ id: "a", brandCanonical: "온사이트", baseColor: "흰" }),
      tee({ id: "b", brandCanonical: "네파", baseColor: "흰" }),
    ];
    const r = searchTees(tees, { ...EMPTY, brand: "온사이트", baseColor: "흰" });
    expect(r.exact.map((t) => t.id)).toEqual(["a"]);
    expect(r.partial.map((t) => t.id)).toEqual(["b"]);
  });

  it("브랜드만 조건이면 그 브랜드만 exact", () => {
    const tees = [tee({ id: "a", brandCanonical: "온사이트" }), tee({ id: "b" })];
    const r = searchTees(tees, { ...EMPTY, brand: "온사이트" });
    expect(r.exact.map((t) => t.id)).toEqual(["a"]);
    expect(r.partial).toEqual([]);
  });

  it("남성 쿼리는 male·unisex 상품에 매칭되고 female은 제외한다", () => {
    const tees = [
      tee({ id: "m", gender: "male" }),
      tee({ id: "u", gender: "unisex" }),
      tee({ id: "f", gender: "female" }),
    ];
    const r = searchTees(tees, { ...EMPTY, gender: "male" });
    expect(r.exact.map((t) => t.id).sort()).toEqual(["m", "u"]);
    expect(r.partial).toEqual([]);
  });

  it("여성 쿼리는 female·unisex 상품에 매칭되고 male은 제외한다", () => {
    const tees = [
      tee({ id: "m", gender: "male" }),
      tee({ id: "u", gender: "unisex" }),
      tee({ id: "f", gender: "female" }),
    ];
    const r = searchTees(tees, { ...EMPTY, gender: "female" });
    expect(r.exact.map((t) => t.id).sort()).toEqual(["f", "u"]);
  });

  it("genderExclusive면 공용을 제외하고 정확 성별만 매칭한다", () => {
    const tees = [
      tee({ id: "f", gender: "female" }),
      tee({ id: "u", gender: "unisex" }),
      tee({ id: "m", gender: "male" }),
    ];
    const r = searchTees(tees, { ...EMPTY, gender: "female", genderExclusive: true });
    expect(r.exact.map((t) => t.id)).toEqual(["f"]);
    expect(r.partial).toEqual([]);
  });

  it("공용 쿼리는 unisex 상품만 매칭한다", () => {
    const tees = [tee({ id: "u", gender: "unisex" }), tee({ id: "m", gender: "male" })];
    const r = searchTees(tees, { ...EMPTY, gender: "unisex" });
    expect(r.exact.map((t) => t.id)).toEqual(["u"]);
  });

  it("gender 미설정이면 성별로 거르지 않는다", () => {
    const tees = [tee({ id: "m", gender: "male" }), tee({ id: "f", gender: "female" })];
    const r = searchTees(tees, EMPTY);
    expect(r.exact.map((t) => t.id)).toEqual(["m", "f"]);
  });

  it("리뷰 긍정태그를 가진 상품을 매칭한다", () => {
    const tees = [
      tee({ id: "a", reviewTags: ["디자인귀여움", "클라이밍"] }),
      tee({ id: "b", reviewTags: ["박시핏"] }),
    ];
    const r = searchTees(tees, { ...EMPTY, reviewTags: ["디자인귀여움"] });
    expect(r.exact.map((t) => t.id)).toEqual(["a"]);
    expect(r.partial).toEqual([]);
  });

  it("기능(functional)과 리뷰태그(냉감)를 하나의 풀로 합쳐 매칭한다", () => {
    // 겹치는 태그 '냉감'은 functional·reviewTags 어느 쪽에 있어도 동일하게 매칭된다.
    const tees = [
      tee({ id: "fn", functional: ["냉감"] }),
      tee({ id: "rv", reviewTags: ["냉감"] }),
      tee({ id: "no", reviewTags: ["박시핏"] }),
    ];
    const r = searchTees(tees, { ...EMPTY, functional: ["냉감"] });
    expect(r.exact.map((t) => t.id).sort()).toEqual(["fn", "rv"]);
    expect(r.partial).toEqual([]);
  });

  it("기피태그(제외 필터)를 가진 상품은 후보에서 뺀다", () => {
    const tees = [
      tee({ id: "ok", baseColor: "흰" }),
      tee({ id: "bad", baseColor: "흰", reviewTags: ["비침있음"] }),
    ];
    const r = searchTees(tees, {
      ...EMPTY,
      baseColor: "흰",
      excludeTags: ["비침있음"],
    });
    expect(r.exact.map((t) => t.id)).toEqual(["ok"]);
  });

  it("제외조건만 있으면 결함 상품을 뺀 나머지를 전부 exact로 반환한다", () => {
    const tees = [tee({ id: "ok" }), tee({ id: "bad", reviewTags: ["목늘어남"] })];
    const r = searchTees(tees, { ...EMPTY, excludeTags: ["목늘어남"] });
    expect(r.exact.map((t) => t.id)).toEqual(["ok"]);
    expect(r.partial).toEqual([]);
  });
});
