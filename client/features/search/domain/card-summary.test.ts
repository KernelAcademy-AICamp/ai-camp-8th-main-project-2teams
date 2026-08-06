import { describe, expect, it } from "vitest";

import type { Goods } from "@/features/catalog/domain/goods";

import { cardSummary } from "./card-summary";

function goods(overrides: Partial<Goods> = {}): Goods {
  return {
    goodsNo: "1",
    styleKey: "",
    title: "티셔츠",
    brand: "브랜드",
    category: "반팔티",
    gender: "",
    colors: [],
    patterns: [],
    materials: [],
    fits: [],
    sizes: [],
    sizeFree: false,
    sizeStd: [],
    price: 10000,
    reviewCount: 0,
    reviewScore: 0,
    gallery: [],
    url: "",
    thumbnail: "",
    wearChars: {},
    sizeMeasures: [],
    ...overrides,
  };
}

describe("cardSummary — 카드 호버 요약 행", () => {
  it("색·핏·소재·착용감을 이 순서로 반환", () => {
    const rows = cardSummary(
      goods({
        colors: ["블랙"],
        fits: ["오버핏"],
        materials: ["코튼"],
        wearChars: { 두께: "두꺼움" },
      }),
    );
    expect(rows.map((r) => r.label)).toEqual(["색", "핏", "소재", "착용감"]);
    expect(rows[0]).toEqual({ label: "색", value: "블랙" });
    expect(rows[3]).toEqual({ label: "착용감", value: "두께 두꺼움" });
  });

  it("값이 없는 축은 생략", () => {
    const rows = cardSummary(goods({ colors: ["화이트"] }));
    expect(rows).toEqual([{ label: "색", value: "화이트" }]);
  });

  it("배열이 3개를 넘으면 +N으로 생략", () => {
    const rows = cardSummary(
      goods({ colors: ["블랙", "화이트", "네이비", "그레이", "베이지"] }),
    );
    expect(rows[0].value).toBe("블랙 · 화이트 · 네이비 +2");
  });

  it("착용감은 WEAR_AXES 순서로, 미지 키·빈 값은 제외", () => {
    const rows = cardSummary(
      goods({
        // 일부러 순서를 뒤섞고 미지 키와 빈 값 포함
        wearChars: { 신축성: "높음", 촉감: "부드러움", 계절: "", 알수없음: "x" },
      }),
    );
    const wear = rows.find((r) => r.label === "착용감");
    expect(wear?.value).toBe("촉감 부드러움 · 신축성 높음");
  });

  it("모든 축이 비면 빈 배열(오버레이 미표시)", () => {
    expect(cardSummary(goods())).toEqual([]);
  });

  it("공백 문자열 값은 무시", () => {
    expect(cardSummary(goods({ colors: ["", "  "], fits: ["레귤러핏"] }))).toEqual([
      { label: "핏", value: "레귤러핏" },
    ]);
  });
});
