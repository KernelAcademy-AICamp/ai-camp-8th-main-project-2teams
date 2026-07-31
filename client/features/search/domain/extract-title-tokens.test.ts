import { describe, expect, it } from "vitest";

import { extractTitleTokens } from "@/features/search/domain/extract-title-tokens";

describe("extractTitleTokens", () => {
  it("브랜드 소비 토큰과 구조화 표현을 빼고 잔여만 남긴다", () => {
    // "나이키 검정 오버핏 3만원 이하 드라이핏 반팔" → 브랜드(나이키)·색·핏·가격·일반어 제거
    expect(
      extractTitleTokens("나이키 검정 오버핏 3만원 이하 드라이핏 반팔", ["나이키"]),
    ).toEqual(["드라이핏"]);
  });

  it("색·핏·성별·일반 의류어만 있으면 빈 배열", () => {
    expect(extractTitleTokens("검정 오버핏 남자 반팔 티셔츠", [])).toEqual([]);
  });

  it("그래픽·테마 토큰은 살아남는다", () => {
    expect(extractTitleTokens("홀로그램 곰 티셔츠", [])).toEqual(["홀로그램"]);
    // "곰"은 1자 토큰 → 정밀도 우선으로 버림(스펙 §4.5: 애매하면 버림)
  });

  it("숫자·가격 토큰 제거", () => {
    expect(extractTitleTokens("쿨링 30000원 이하", [])).toEqual(["쿨링"]);
  });

  it("중복 제거·최대 4토큰", () => {
    const got = extractTitleTokens("알파 알파 브라보 찰리 델타 에코", []);
    expect(got).toEqual(["알파", "브라보", "찰리", "델타"]);
  });

  it("브랜드 소비 토큰은 대소문자 무시로 제거", () => {
    expect(extractTitleTokens("COVERNAT 어센틱 로고", ["covernat"])).toEqual([
      "어센틱",
      "로고",
    ]);
  });
});
