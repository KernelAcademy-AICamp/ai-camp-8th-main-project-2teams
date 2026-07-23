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
});
