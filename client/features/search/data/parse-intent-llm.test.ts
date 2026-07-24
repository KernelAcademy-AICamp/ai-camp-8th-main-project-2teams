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
    });
    const fetchFn = vi.fn().mockResolvedValue(llmResponse(content));
    const r = await parseIntentLLM("홀로그램 느낌 흰 티", fetchFn);
    expect(r.intent.baseColor).toBe("흰");
    expect(r.semanticQuery).toContain("홀로그램");
  });

  it("semanticQuery가 없으면 원쿼리로 폴백한다", async () => {
    vi.stubEnv("NVIDIA_API_KEY", "k");
    const fetchFn = vi.fn().mockResolvedValue(llmResponse('{"functional":[]}'));
    const r = await parseIntentLLM("빨간 티", fetchFn);
    expect(r.semanticQuery).toBe("빨간 티");
  });

  it("키가 없으면 EMPTY intent + 원쿼리를 반환한다", async () => {
    vi.stubEnv("NVIDIA_API_KEY", "");
    const r = await parseIntentLLM("아무거나");
    expect(r.intent).toEqual({ functional: [] });
    expect(r.semanticQuery).toBe("아무거나");
  });
});
