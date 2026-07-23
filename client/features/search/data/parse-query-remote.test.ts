import { afterEach, describe, expect, it, vi } from "vitest";

import { parseQueryRemote } from "@/features/search/data/parse-query-remote";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parseQueryRemote 브랜드 레이어", () => {
  it("LLM 성공 결과 위에 브랜드를 얹는다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ intent: { functional: [], baseColor: "흰" } }),
      }),
    );
    const intent = await parseQueryRemote("온사이트 흰 티", [
      { canonical: "온사이트", aliases: ["온사이트"] },
    ]);
    expect(intent.brand).toBe("온사이트");
    expect(intent.baseColor).toBe("흰");
  });

  it("LLM 실패(폴백)에도 브랜드를 얹는다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    const intent = await parseQueryRemote("온사이트 오버핏", [
      { canonical: "온사이트", aliases: ["온사이트"] },
    ]);
    expect(intent.brand).toBe("온사이트");
    expect(intent.fit).toBe("오버"); // 규칙 폴백이 동작
  });

  it("브랜드 사전이 비면 brand 없이 파싱만 반환", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    const intent = await parseQueryRemote("오버핏 반팔", []);
    expect(intent.brand).toBeUndefined();
    expect(intent.fit).toBe("오버");
  });
});
