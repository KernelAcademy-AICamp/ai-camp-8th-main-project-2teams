import { afterEach, describe, expect, it, vi } from "vitest";

import { embedQuery } from "@/features/search/data/embed-query";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("embedQuery", () => {
  it("텍스트를 임베딩 벡터로 반환한다", async () => {
    vi.stubEnv("NVIDIA_API_KEY", "k");
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [{ index: 0, embedding: [0.1, 0.2, 0.3] }] }),
    });
    const vec = await embedQuery("홀로그램 티", fetchFn);
    expect(vec).toEqual([0.1, 0.2, 0.3]);
    const call = fetchFn.mock.calls[0][1] as { body: string };
    const body = JSON.parse(call.body) as { input_type: string };
    expect(body.input_type).toBe("query");
  });

  it("키가 없으면 null", async () => {
    vi.stubEnv("NVIDIA_API_KEY", "");
    expect(await embedQuery("x")).toBeNull();
  });

  it("빈 텍스트면 null", async () => {
    vi.stubEnv("NVIDIA_API_KEY", "k");
    expect(await embedQuery("   ")).toBeNull();
  });

  it("오류 응답이면 null", async () => {
    vi.stubEnv("NVIDIA_API_KEY", "k");
    const fetchFn = vi.fn().mockResolvedValue({ ok: false });
    expect(await embedQuery("x", fetchFn as unknown as typeof fetch)).toBeNull();
  });
});
