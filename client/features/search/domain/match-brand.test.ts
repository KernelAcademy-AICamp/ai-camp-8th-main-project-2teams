import { describe, expect, it } from "vitest";

import { type BrandEntry, matchBrand } from "@/features/search/domain/match-brand";

const BRANDS: BrandEntry[] = [
  { canonical: "온사이트", aliases: ["온사이트", "ONSIGHT"] },
  { canonical: "코오롱스포츠", aliases: ["코오롱스포츠", "코오롱", "KOLON"] },
  { canonical: "레몬클라임비터", aliases: ["레몬클라임비터", "레클비"] },
];

describe("matchBrand", () => {
  it("canonical 이름으로 매칭한다", () => {
    expect(matchBrand("온사이트 오버핏 티", BRANDS)).toBe("온사이트");
  });

  it("영문 별칭을 대소문자 무시로 매칭한다", () => {
    expect(matchBrand("kolon 반팔", BRANDS)).toBe("코오롱스포츠");
  });

  it("약칭(레클비)으로도 매칭한다", () => {
    expect(matchBrand("레클비 클라이밍 반팔티", BRANDS)).toBe("레몬클라임비터");
  });

  it("긴 별칭이 짧은 별칭보다 우선한다", () => {
    expect(matchBrand("코오롱스포츠 볼더링", BRANDS)).toBe("코오롱스포츠");
  });

  it("매칭 없으면 undefined", () => {
    expect(matchBrand("이름없는 반팔티", BRANDS)).toBeUndefined();
  });

  it("빈 사전이면 undefined", () => {
    expect(matchBrand("온사이트", [])).toBeUndefined();
  });
});
