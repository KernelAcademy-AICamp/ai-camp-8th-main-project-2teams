import { describe, expect, it, vi } from "vitest";

import type { Goods } from "@/features/catalog/domain/goods";
import { searchRemote } from "@/features/search/data/search-remote";
import { EMPTY_INTENT } from "@/features/search/domain/query-intent";

function res(body: unknown, ok = true): Response {
  return { ok, json: () => Promise.resolve(body) } as unknown as Response;
}
const goods = [{ goodsNo: "1", title: "블랙 반팔" } as Goods];

describe("searchRemote", () => {
  it("빈 쿼리는 서버 호출 없이 빈 결과", async () => {
    const fetchMock = vi.fn();
    const r = await searchRemote("  ", fetchMock);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(r).toEqual({ results: [], intent: EMPTY_INTENT, degraded: false });
  });
  it("성공 응답을 그대로 반환", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        res({ results: goods, intent: EMPTY_INTENT, degraded: false }),
      );
    const r = await searchRemote("블랙 반팔", fetchMock);
    expect(r.results).toEqual(goods);
    expect(r.degraded).toBe(false);
  });
  it("degraded 응답은 빈 결과로 강등(폴백 없음)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(res({ results: [], intent: EMPTY_INTENT, degraded: true }));
    expect(
      (await searchRemote("x", fetchMock as unknown as typeof fetch)).degraded,
    ).toBe(true);
  });
  it("네트워크 오류는 degraded 빈 결과", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("net"));
    expect(await searchRemote("x", fetchMock as unknown as typeof fetch)).toEqual({
      results: [],
      intent: EMPTY_INTENT,
      degraded: true,
    });
  });
});
