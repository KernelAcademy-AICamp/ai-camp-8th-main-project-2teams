import { describe, expect, it } from "vitest";

import { WEAR_CHARS_VOCAB } from "@/features/search/data/wear-chars-vocab";
import { WEAR_AXES } from "@/features/search/domain/query-intent";

describe("WEAR_CHARS_VOCAB", () => {
  it("모든 축을 덮고 빈 축이 없다", () => {
    for (const axis of WEAR_AXES) {
      expect(WEAR_CHARS_VOCAB[axis].length).toBeGreaterThan(0);
    }
  });

  it("축별 exact set을 고정한다(오타·순서·누락 회귀 방지)", () => {
    // 2026-07-30 search_goods distinct 스냅샷. DB에 신규값 생기면 이 테스트가 깨져 갱신을 강제한다.
    expect(WEAR_CHARS_VOCAB).toEqual({
      촉감: ["부드러움", "약간|부드러움", "보통", "약간|뻣뻣함"],
      두께: ["얇음", "약간 얇음", "보통", "약간|두꺼움", "두꺼움"],
      비침: ["없음", "거의 없음", "보통", "약간 있음", "있음"],
      신축성: ["있음", "약간 있음", "보통", "거의 없음", "없음"],
      계절: ["봄", "여름"],
    });
  });
});
