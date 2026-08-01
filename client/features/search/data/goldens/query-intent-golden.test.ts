// 쿼리 골든셋 무결성 검사 — 정답 상품이 스냅샷에 실존하고, 기대값이 vocab에 실존하며,
// 의도 유형 커버리지가 계획 목표(유형별 3+·전체 30+)를 지키는지 기계적으로 고정한다.
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  COLORS,
  FITS,
  MATERIALS,
  PATTERNS,
} from "@/features/search/data/musinsa-vocab";

interface AnswerGood {
  goodsNo: number;
  basis: string;
}
interface GoldenQuery {
  id: string;
  query: string;
  source: "real_query" | "synthetic";
  categories: string[];
  expected: {
    colors?: string[];
    patterns?: string[];
    materials?: string[];
    fits?: string[];
    brand?: string;
  };
  answerType: "must_include" | "sort" | "browse" | "none" | "interpretation_only";
  answerGoods?: AnswerGood[];
}

const golden = JSON.parse(
  readFileSync(new URL("./query-intent-golden.json", import.meta.url), "utf8"),
) as {
  meta: { categories: string[]; snapshot: { sha256: string } };
  entries: GoldenQuery[];
};

const snapshot = JSON.parse(
  readFileSync(
    new URL(
      "../../../../../docs/p3-t0/search-goods-snapshot-20260801.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as { rows: { goods_no: number; brand: string }[] };

const snapGoods = new Set(snapshot.rows.map((r) => r.goods_no));
const snapBrands = new Set(snapshot.rows.map((r) => r.brand));

describe("query-intent-golden 무결성", () => {
  it("모든 정답 상품이 스냅샷에 실존한다", () => {
    const missing = golden.entries.flatMap((e) =>
      (e.answerGoods ?? [])
        .filter((g) => !snapGoods.has(g.goodsNo))
        .map((g) => `${e.id}:${String(g.goodsNo)}`),
    );
    expect(missing).toEqual([]);
  });

  it("기대 facet 값이 전부 현재 vocab에 실존한다", () => {
    const vocab = {
      colors: new Set(COLORS),
      patterns: new Set(PATTERNS),
      materials: new Set(MATERIALS),
      fits: new Set(FITS),
    };
    const bad: string[] = [];
    for (const e of golden.entries) {
      for (const axis of ["colors", "patterns", "materials", "fits"] as const) {
        for (const v of e.expected[axis] ?? []) {
          if (!vocab[axis].has(v)) bad.push(`${e.id}:${axis}:${v}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("기대 브랜드가 스냅샷에 실존한다", () => {
    const bad = golden.entries
      .filter((e) => e.expected.brand && !snapBrands.has(e.expected.brand))
      .map((e) => e.id);
    expect(bad).toEqual([]);
  });

  it("규모: 전체 30개 이상, 의도 유형 10종이 각 3개 이상", () => {
    expect(golden.entries.length).toBeGreaterThanOrEqual(30);
    for (const cat of golden.meta.categories) {
      const n = golden.entries.filter((e) => e.categories.includes(cat)).length;
      expect(n, `category=${cat}`).toBeGreaterThanOrEqual(3);
    }
  });

  it("설계 §1 요동 실측 쿼리가 회귀 케이스로 포함돼 있다", () => {
    expect(golden.entries.some((e) => e.query.includes("바람이 슝슝"))).toBe(true);
  });

  it("must_include는 정답 1개 이상, 그 외 유형은 정답 목록이 없다", () => {
    for (const e of golden.entries) {
      if (e.answerType === "must_include") {
        expect((e.answerGoods ?? []).length, e.id).toBeGreaterThanOrEqual(1);
      } else {
        expect(e.answerGoods, e.id).toBeUndefined();
      }
    }
  });

  it("쿼리 중복이 없다", () => {
    const qs = golden.entries.map((e) => e.query);
    expect(new Set(qs).size).toBe(qs.length);
  });
});
