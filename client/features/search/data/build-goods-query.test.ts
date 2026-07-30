import { describe, expect, it } from "vitest";

import {
  buildGoodsQuery,
  type GoodsQuery,
  pgArray,
} from "@/features/search/data/build-goods-query";
import { EMPTY_INTENT, type QueryIntent } from "@/features/search/domain/query-intent";

type Call = [string, ...unknown[]];

// GoodsQuery를 만족하는 기록용 더블 — 호출을 순서대로 기록하고 자기 자신을 반환.
function recorder(): GoodsQuery & { calls: Call[] } {
  const calls: Call[] = [];
  const self = {
    calls,
    eq(c: string, v: unknown) {
      calls.push(["eq", c, v]);
      return self;
    },
    or(f: string) {
      calls.push(["or", f]);
      return self;
    },
    gte(c: string, v: unknown) {
      calls.push(["gte", c, v]);
      return self;
    },
    lte(c: string, v: unknown) {
      calls.push(["lte", c, v]);
      return self;
    },
    overlaps(c: string, v: readonly unknown[]) {
      calls.push(["overlaps", c, [...v]]);
      return self;
    },
    not(c: string, op: string, v: unknown) {
      calls.push(["not", c, op, v]);
      return self;
    },
    order(c: string, o: { ascending: boolean }) {
      calls.push(["order", c, o]);
      return self;
    },
    limit(n: number) {
      calls.push(["limit", n]);
      return self;
    },
  };
  return self;
}
function intent(p: Partial<QueryIntent>): QueryIntent {
  return {
    ...EMPTY_INTENT,
    ...p,
    style: { ...EMPTY_INTENT.style, ...(p.style ?? {}) },
    exclude: { ...EMPTY_INTENT.exclude, ...(p.exclude ?? {}) },
  };
}

describe("pgArray", () => {
  it("값을 큰따옴표로 감싼 배열 리터럴", () => {
    expect(pgArray(["블랙", "스카이 블루"])).toBe('{"블랙","스카이 블루"}');
  });
});

describe("buildGoodsQuery", () => {
  it("빈 intent도 order·limit 백스톱을 건다", () => {
    const r = recorder();
    buildGoodsQuery(r, EMPTY_INTENT);
    expect(r.calls).toContainEqual(["order", "review_score", { ascending: false }]);
    expect(r.calls).toContainEqual(["limit", 3000]);
  });

  it("하드 필터: gender·size(or)·price", () => {
    const r = recorder();
    buildGoodsQuery(
      r,
      intent({ gender: "남성", sizeStd: [95, 100], priceMin: 10000, priceMax: 40000 }),
    );
    expect(r.calls).toContainEqual(["eq", "gender", "남성"]);
    expect(r.calls).toContainEqual(["or", "size_std.ov.{95,100},size_free.eq.true"]);
    expect(r.calls).toContainEqual(["gte", "price", 10000]);
    expect(r.calls).toContainEqual(["lte", "price", 40000]);
  });

  it("promote된 스타일은 overlaps 하드필터(keywords 제외)", () => {
    const r = recorder();
    buildGoodsQuery(
      r,
      intent({
        style: {
          colors: ["블랙"],
          patterns: [],
          materials: [],
          fits: ["오버"],
          keywords: ["빈티지"],
        },
        promote: ["fits", "keywords"],
      }),
    );
    expect(r.calls).toContainEqual(["overlaps", "fits", ["오버"]]);
    // colors는 promote 안 됨 → 하드 아님
    expect(
      r.calls.find((c) => c[0] === "overlaps" && c[1] === "colors"),
    ).toBeUndefined();
    // keywords는 promote돼도 하드 승격 안 함
    expect(
      r.calls.find((c) => c[0] === "overlaps" && c[1] === "keywords"),
    ).toBeUndefined();
  });

  it("exclude: 배열은 not.ov, 키워드는 not.ilike", () => {
    const r = recorder();
    buildGoodsQuery(
      r,
      intent({
        exclude: {
          colors: ["블랙"],
          patterns: [],
          materials: ["면"],
          fits: [],
          keywords: ["로고"],
        },
      }),
    );
    expect(r.calls).toContainEqual(["not", "colors", "ov", '{"블랙"}']);
    expect(r.calls).toContainEqual(["not", "materials", "ov", '{"면"}']);
    expect(r.calls).toContainEqual(["not", "title", "ilike", "%로고%"]);
  });
});

describe("buildGoodsQuery wear-chars 불변식·후보 상한", () => {
  it("wearChars가 있어도 wear 관련 필터를 만들지 않는다(soft-only)", () => {
    const r = recorder();
    buildGoodsQuery(
      r,
      intent({ wearChars: { ...EMPTY_INTENT.wearChars, 촉감: ["부드러움"] } }),
    );
    const mentionsWear = r.calls.some((c) =>
      c.some((a) => typeof a === "string" && a.includes("wear")),
    );
    expect(mentionsWear).toBe(false);
  });

  it("후보 상한이 현재 코퍼스(2,472)를 덮는다", () => {
    const r = recorder();
    buildGoodsQuery(r, EMPTY_INTENT);
    const limitCall = r.calls.find((c) => c[0] === "limit");
    expect(limitCall?.[1]).toBeGreaterThanOrEqual(2500);
  });
});
