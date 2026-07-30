import { afterEach, describe, expect, it, vi } from "vitest";

import { parseQueryIntent } from "@/features/search/data/parse-query-intent";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

function llm(content: string) {
  return {
    ok: true,
    json: () => Promise.resolve({ choices: [{ message: { content } }] }),
  };
}

describe("parseQueryIntent", () => {
  it("enum 값·사이즈·정렬을 구조화해 반환한다", async () => {
    vi.stubEnv("NVIDIA_API_KEY", "k");
    const content = JSON.stringify({
      gender: "남성",
      sizeStd: [95],
      priceMax: 40000,
      style: {
        colors: ["블랙"],
        patterns: [],
        materials: ["면"],
        fits: ["오버"],
        keywords: ["빈티지"],
      },
      promote: ["fits"],
      exclude: { colors: [], patterns: [], materials: [], fits: [], keywords: [] },
      sort: "price_asc",
    });
    const r = await parseQueryIntent(
      "블랙 오버핏 면 95 3만원대 빈티지 싼거",
      vi.fn().mockResolvedValue(llm(content)),
    );
    expect(r.degraded).toBe(false);
    expect(r.intent.gender).toBe("남성");
    expect(r.intent.sizeStd).toEqual([95]);
    expect(r.intent.priceMax).toBe(40000);
    expect(r.intent.style.colors).toEqual(["블랙"]);
    expect(r.intent.style.fits).toEqual(["오버"]);
    expect(r.intent.promote).toEqual(["fits"]);
    expect(r.intent.sort).toBe("price_asc");
  });

  it("enum 밖 값은 조용히 제거한다(validate-drop)", async () => {
    vi.stubEnv("NVIDIA_API_KEY", "k");
    const content = JSON.stringify({
      style: {
        colors: ["검정색", "블랙"],
        patterns: ["없는패턴"],
        materials: [],
        fits: [],
        keywords: [],
      },
      sort: "relevance",
    });
    const r = await parseQueryIntent(
      "검정 티",
      vi.fn().mockResolvedValue(llm(content)),
    );
    expect(r.intent.style.colors).toEqual(["블랙"]); // "검정색"은 목록 밖 → 제거
    expect(r.intent.style.patterns).toEqual([]);
  });

  it("이상한 sort·promote·size는 안전 강등한다", async () => {
    vi.stubEnv("NVIDIA_API_KEY", "k");
    const content = JSON.stringify({
      sizeStd: [95, 999, 3.5],
      promote: ["keywords", "colors", "몰라"],
      sort: "무작위",
      style: { colors: ["블랙"], patterns: [], materials: [], fits: [], keywords: [] },
    });
    const r = await parseQueryIntent("x", vi.fn().mockResolvedValue(llm(content)));
    expect(r.intent.sizeStd).toEqual([95]); // 999(범위밖)·3.5(비정수) 제거
    expect(r.intent.promote).toEqual(["colors"]); // keywords·불량키 제거
    expect(r.intent.sort).toBe("relevance"); // 불량 → 기본
  });

  it("빈 쿼리는 EMPTY_INTENT·degraded=false", async () => {
    const r = await parseQueryIntent("   ", vi.fn());
    expect(r.degraded).toBe(false);
    expect(r.intent.sort).toBe("relevance");
    expect(r.intent.style.colors).toEqual([]);
  });

  it("LLM 실패 시 EMPTY_INTENT·degraded=true", async () => {
    vi.stubEnv("NVIDIA_API_KEY", "k");
    const r = await parseQueryIntent(
      "블랙 티",
      vi.fn().mockResolvedValue({ ok: false }),
    );
    expect(r.degraded).toBe(true);
    expect(r.intent.style.colors).toEqual([]);
  });

  it("API 키 없으면 degraded=true", async () => {
    const r = await parseQueryIntent("블랙 티", vi.fn());
    expect(r.degraded).toBe(true);
  });
});
