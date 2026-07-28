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

  it("허용 목록 밖 태그는 걸러내고, 긍정 품질태그는 짝 결함태그를 자동 제외에 넣는다", async () => {
    vi.stubEnv("NVIDIA_API_KEY", "k");
    const content = JSON.stringify({
      functional: [],
      reviewTags: ["비침없음", "목안늘어남", "존재안함태그"],
      excludeTags: ["까슬함"],
    });
    const fetchFn = vi.fn().mockResolvedValue(llmResponse(content));
    const r = await parseIntentLLM(
      "안 비치고 목 안 늘어나는 까슬하지 않은 티",
      fetchFn,
    );
    // 허용 목록 밖 태그 제거
    expect(r.intent.reviewTags).toEqual(["비침없음", "목안늘어남"]);
    // LLM이 준 까슬함 + 짝 결함(비침있음·목늘어남) 자동 페어링(순서 무관)
    expect(new Set(r.intent.excludeTags)).toEqual(
      new Set(["까슬함", "비침있음", "목늘어남"]),
    );
  });

  it("긍정태그가 excludeTags에 짝을 이미 포함해도 중복되지 않는다", async () => {
    vi.stubEnv("NVIDIA_API_KEY", "k");
    const content = JSON.stringify({
      functional: [],
      reviewTags: ["보풀안생김"],
      excludeTags: ["보풀생김"],
    });
    const fetchFn = vi.fn().mockResolvedValue(llmResponse(content));
    const r = await parseIntentLLM("보풀 안 생기는 티", fetchFn);
    expect(r.intent.excludeTags).toEqual(["보풀생김"]);
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
