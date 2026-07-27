import { describe, expect, it } from "vitest";

import type { Intent } from "@/features/search/domain/intent";

import { reconcileWorkingIntent } from "./reconcile-working-intent";

const EMPTY: Intent = { functional: [] };

describe("reconcileWorkingIntent", () => {
  it("새 파싱이 도착하면 낡은 workingIntent 대신 parsed.intent를 쓴다", () => {
    // 회귀: parsing이 먼저 false가 된 한 프레임 동안 workingIntent가 아직
    // 브랜드 없는 상태라, 낡은 값을 쓰면 제약이 사라져 전체 상품이 튄다.
    const parsed = {
      query: "레클비",
      intent: { functional: [], brand: "레몬 클라임 비터" },
    };
    const prevParsed = { query: "", intent: EMPTY };
    const staleWorking = EMPTY; // 아직 브랜드 반영 전

    const result = reconcileWorkingIntent(parsed, prevParsed, staleWorking);

    expect(result).toBe(parsed.intent);
    expect(result.brand).toBe("레몬 클라임 비터");
  });

  it("파싱 변화가 없으면 편집된 workingIntent를 유지한다(칩 삭제 보존)", () => {
    const parsed = {
      query: "레클비",
      intent: { functional: [], brand: "레몬 클라임 비터" },
    };
    const editedWorking: Intent = { functional: [] }; // 사용자가 브랜드 칩 제거

    // parsed === prevParsed (같은 참조) → 새 파싱 아님
    const result = reconcileWorkingIntent(parsed, parsed, editedWorking);

    expect(result).toBe(editedWorking);
    expect(result.brand).toBeUndefined();
  });
});
