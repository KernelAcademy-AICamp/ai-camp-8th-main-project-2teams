import { afterEach, describe, expect, it, vi } from "vitest";

import { parseIntentLLM } from "@/features/search/data/parse-intent-llm";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

function llmResponse(content: string) {
  return {
    ok: true,
    json: () => Promise.resolve({ choices: [{ message: { content } }] }),
  };
}

describe("parseIntentLLM", () => {
  it("intent와 semanticQuery를 함께 반환한다", async () => {
    vi.stubEnv("NVIDIA_API_KEY", "k");
    const content = JSON.stringify({
      baseColor: "흰",
      functional: [],
      semanticQuery: "홀로그램 메탈릭 반짝이는 그래픽 티셔츠",
      keywords: ["홀로그램"],
    });
    const fetchFn = vi.fn().mockResolvedValue(llmResponse(content));
    const r = await parseIntentLLM("홀로그램 느낌 흰 티", fetchFn);
    expect(r.intent.baseColor).toBe("흰");
    expect(r.semanticQuery).toContain("홀로그램");
    expect(r.keywords).toEqual(["홀로그램"]);
    expect(r.degraded).toBe(false);
  });

  it("semanticQuery가 없으면 원쿼리로 폴백한다", async () => {
    vi.stubEnv("NVIDIA_API_KEY", "k");
    const fetchFn = vi.fn().mockResolvedValue(llmResponse('{"functional":[]}'));
    const r = await parseIntentLLM("빨간 티", fetchFn);
    expect(r.semanticQuery).toBe("빨간 티");
    expect(r.keywords).toEqual([]);
    expect(r.degraded).toBe(false);
  });

  it("keywords에서 일반 의류어 stopword를 제거한다", async () => {
    vi.stubEnv("NVIDIA_API_KEY", "k");
    const content = JSON.stringify({
      functional: [],
      keywords: ["홀로그램", "티셔츠"],
    });
    const fetchFn = vi.fn().mockResolvedValue(llmResponse(content));
    const r = await parseIntentLLM("홀로그램 티셔츠", fetchFn);
    expect(r.keywords).toEqual(["홀로그램"]);
    expect(r.degraded).toBe(false);
  });

  it("키가 없으면 EMPTY intent + 원쿼리 + degraded를 반환한다", async () => {
    vi.stubEnv("NVIDIA_API_KEY", "");
    const r = await parseIntentLLM("아무거나");
    expect(r.intent).toEqual({ functional: [] });
    expect(r.semanticQuery).toBe("아무거나");
    expect(r.keywords).toEqual([]);
    expect(r.degraded).toBe(true);
  });

  it("res.ok가 false면 degraded로 폴백한다", async () => {
    vi.stubEnv("NVIDIA_API_KEY", "k");
    const fetchFn = vi.fn().mockResolvedValue({ ok: false });
    const r = await parseIntentLLM("검정 티", fetchFn);
    expect(r.intent).toEqual({ functional: [] });
    expect(r.semanticQuery).toBe("검정 티");
    expect(r.keywords).toEqual([]);
    expect(r.degraded).toBe(true);
  });

  it("fetch가 예외를 던지면 degraded로 폴백한다", async () => {
    vi.stubEnv("NVIDIA_API_KEY", "k");
    const fetchFn = vi.fn().mockRejectedValue(new Error("network"));
    const r = await parseIntentLLM("파란 티", fetchFn);
    expect(r.intent).toEqual({ functional: [] });
    expect(r.semanticQuery).toBe("파란 티");
    expect(r.keywords).toEqual([]);
    expect(r.degraded).toBe(true);
  });

  it("빈 쿼리는 실패가 아니다(degraded=false)", async () => {
    vi.stubEnv("NVIDIA_API_KEY", "k");
    const fetchFn = vi.fn();
    const r = await parseIntentLLM("   ", fetchFn);
    expect(r.intent).toEqual({ functional: [] });
    expect(r.semanticQuery).toBe("");
    expect(r.keywords).toEqual([]);
    expect(r.degraded).toBe(false);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
