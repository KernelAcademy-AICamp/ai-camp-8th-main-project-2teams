import { describe, expect, it } from "vitest";

import type { Intent } from "@/features/search/domain/intent";
import { intentToChips } from "@/features/search/domain/intent-chips";

describe("intentToChips", () => {
  it("정해진 순서(위치→프린팅→바탕→핏→그래픽→기능성)로 칩을 만든다", () => {
    const intent: Intent = {
      baseColor: "흰",
      printColor: "검정",
      printPosition: "뒤",
      fit: "오버",
      graphicType: "레터링",
      functional: ["냉감"],
    };
    const chips = intentToChips(intent);
    expect(chips.map((c) => c.kind)).toEqual([
      "position",
      "print",
      "base",
      "fit",
      "graphic",
      "functional",
    ]);
  });

  it("위치는 한글 라벨로, 색 칩에는 color가 붙는다", () => {
    const chips = intentToChips({
      printPosition: "뒤",
      baseColor: "흰",
      functional: [],
    });
    expect(chips.find((c) => c.kind === "position")?.label).toBe("등판");
    expect(chips.find((c) => c.kind === "base")?.color).toBe("흰");
  });

  it("빈 Intent는 빈 배열을 만든다", () => {
    expect(intentToChips({ functional: [] })).toEqual([]);
  });

  it("gender가 있으면 라벨 칩을 만든다", () => {
    const chips = intentToChips({ functional: [], gender: "male" });
    expect(chips).toContainEqual({ label: "남성", kind: "gender" });
  });
});
