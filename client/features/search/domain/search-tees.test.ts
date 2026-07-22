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
});
