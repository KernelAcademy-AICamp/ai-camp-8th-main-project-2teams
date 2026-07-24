import { afterEach, describe, expect, it, vi } from "vitest";

import type { Tee } from "@/features/catalog/domain/tee";
import { searchRemote } from "@/features/search/data/search-remote";

afterEach(() => vi.restoreAllMocks());

function tee(over: Partial<Tee> & { id: string }): Tee {
  return {
    name: "t",
    brand: "b",
    price: 1,
    mall: "m",
    link: "x",
    gender: "unisex",
    functional: [],
    sizes: [],
    ...over,
  };
}

describe("searchRemote", () => {
  it("서버 성공 결과를 exact 랭킹으로 반환한다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            results: [
              {
                id: "곰",
                name: "홀로그램 곰 티",
                brand: "b",
                price: 1,
                mall: "m",
                link: "x",
                gender: "unisex",
                functional: [],
                sizes: [],
              },
            ],
            intent: { functional: [] },
            semanticQuery: "홀로그램",
            degraded: false,
          }),
      }),
    );
    const r = await searchRemote("홀로그램 느낌 티", [], []);
    expect(r.results.exact.map((t) => t.id)).toEqual(["곰"]);
    expect(r.results.partial).toEqual([]);
  });

  it("서버 성공 경로에서도 결정적 브랜드 매칭을 intent에 얹는다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            results: [
              {
                id: "곰",
                name: "온사이트 곰 티",
                brand: "b",
                price: 1,
                mall: "m",
                link: "x",
                gender: "unisex",
                functional: [],
                sizes: [],
              },
            ],
            intent: { functional: [] },
            semanticQuery: "온사이트",
            degraded: false,
          }),
      }),
    );
    const brands = [{ canonical: "온사이트", aliases: ["온사이트"] }];
    const r = await searchRemote("온사이트 곰 티", brands, []);
    expect(r.intent.brand).toBe("온사이트");
  });

  it("degraded면 로컬 폴백(searchTees)으로 계산한다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            results: [],
            intent: { functional: [] },
            semanticQuery: "",
            degraded: true,
          }),
      }),
    );
    const fallback = [
      tee({ id: "빨강", baseColor: "빨강" }),
      tee({ id: "흰", baseColor: "흰" }),
    ];
    const r = await searchRemote("빨간 티", [], fallback);
    // 규칙 폴백 파서가 "빨강"을 잡아 빨강 티가 매칭됨
    expect(r.results.exact.map((t) => t.id)).toContain("빨강");
  });

  it("네트워크 오류면 로컬 폴백", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("net")));
    const fallback = [tee({ id: "흰", baseColor: "흰" })];
    const r = await searchRemote("흰 티", [], fallback);
    expect(r.results.exact.map((t) => t.id)).toContain("흰");
  });
});
