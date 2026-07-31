import { afterEach, describe, expect, it, vi } from "vitest";

import {
  _clearAliasCache,
  type AliasDb,
  getSafeBrandAliases,
} from "@/features/search/data/brand-alias-repository";

afterEach(() => {
  _clearAliasCache();
  vi.restoreAllMocks();
});

interface FakeDb {
  db: AliasDb;
  selects: () => number;
}

function fakeDb(rows: unknown, error: unknown = null): FakeDb {
  let count = 0;
  const db: AliasDb = {
    from: () => ({
      select: () => ({
        eq: () => {
          count += 1;
          return Promise.resolve({ data: rows as never, error });
        },
      }),
    }),
  };
  return { db, selects: () => count };
}

describe("getSafeBrandAliases", () => {
  it("safe alias를 camelCase로 매핑한다", async () => {
    const { db } = fakeDb([{ alias_normalized: "나이키", catalog_brand: "나이키" }]);
    const out = await getSafeBrandAliases(db);
    expect(out).toEqual([{ aliasNormalized: "나이키", catalogBrand: "나이키" }]);
  });

  it("성공 결과는 캐시된다(TTL 내 재조회 없음)", async () => {
    const { db, selects } = fakeDb([{ alias_normalized: "a3x", catalog_brand: "A3X" }]);
    await getSafeBrandAliases(db);
    await getSafeBrandAliases(db);
    expect(selects()).toBe(1);
  });

  it("조회 실패는 throw(호출자가 failed 처리)", async () => {
    const { db } = fakeDb(null, { message: "boom" });
    await expect(getSafeBrandAliases(db)).rejects.toThrow();
  });
});
