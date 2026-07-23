import { describe, expect, it } from "vitest";

import type { Intent, IntentChip } from "@/features/search/domain/intent";
import { removeConstraintFromIntent } from "@/features/search/domain/remove-constraint";

const base: Intent = {
  baseColor: "흰",
  printColor: "검정",
  printPosition: "뒤",
  fit: "오버",
  graphicType: "레터링",
  functional: ["냉감", "통풍"],
};

describe("removeConstraintFromIntent", () => {
  it("base 칩은 baseColor를 제거한다", () => {
    const chip: IntentChip = { label: "흰 바탕", kind: "base", color: "흰" };
    expect(removeConstraintFromIntent(base, chip).baseColor).toBeUndefined();
  });

  it("position 칩은 printPosition을 제거한다", () => {
    const chip: IntentChip = { label: "등판", kind: "position" };
    expect(removeConstraintFromIntent(base, chip).printPosition).toBeUndefined();
  });

  it("functional 칩은 라벨에 해당하는 항목만 제거한다", () => {
    const chip: IntentChip = { label: "냉감", kind: "functional" };
    expect(removeConstraintFromIntent(base, chip).functional).toEqual(["통풍"]);
  });

  it("원본 Intent를 변형하지 않는다(불변)", () => {
    const chip: IntentChip = { label: "흰 바탕", kind: "base", color: "흰" };
    removeConstraintFromIntent(base, chip);
    expect(base.baseColor).toBe("흰");
  });

  it("브랜드 칩을 제거한다", () => {
    const chip: IntentChip = { label: "온사이트", kind: "brand" };
    const next = removeConstraintFromIntent(
      { functional: [], brand: "온사이트" },
      chip,
    );
    expect(next.brand).toBeUndefined();
  });
});
