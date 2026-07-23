import { describe, expect, it } from "vitest";

import { parseQuery } from "@/features/search/domain/parse-query";

describe("parseQuery — 색 분리", () => {
  it("프린팅 힌트가 바로 뒤에 오면 프린팅색, 바탕 힌트면 바탕색", () => {
    const { intent } = parseQuery("노란 프린팅 흰 티");
    expect(intent.printColor).toBe("노랑");
    expect(intent.baseColor).toBe("흰");
  });

  it("'흰 바탕 검정 레터링'을 바탕/프린팅으로 바르게 분리한다", () => {
    const { intent } = parseQuery("흰 바탕 검정 레터링");
    expect(intent.baseColor).toBe("흰");
    expect(intent.printColor).toBe("검정");
    expect(intent.graphicType).toBe("레터링");
  });

  it("색이 하나면 바탕색을 기본으로 채운다", () => {
    const { intent } = parseQuery("노란 티");
    expect(intent.baseColor).toBe("노랑");
    expect(intent.printColor).toBeUndefined();
  });

  it("'등판에 노란 로고'는 위치·프린팅색·그래픽을 채운다", () => {
    const { intent } = parseQuery("등판에 노란 로고");
    expect(intent.printPosition).toBe("뒤");
    expect(intent.printColor).toBe("노랑");
    expect(intent.graphicType).toBe("로고");
  });

  it("1글자 별칭이 긴 색 이름 안에 묻혀도 다른 색을 잃지 않는다", () => {
    const { intent } = parseQuery("검정 프린팅 빨간 바탕");
    expect(intent.printColor).toBe("검정");
    expect(intent.baseColor).toBe("빨강");
  });

  it("기능성 표현을 정규화한다", () => {
    const { intent } = parseQuery("시원한 오버핏");
    expect(intent.functional).toContain("냉감");
    expect(intent.fit).toBe("오버");
  });

  it("남성 쿼리에서 gender=male을 뽑는다", () => {
    expect(parseQuery("남성 클라이밍 반팔티").intent.gender).toBe("male");
  });

  it("여성 쿼리에서 gender=female을 뽑는다", () => {
    expect(parseQuery("여성 우먼 클라이밍 티").intent.gender).toBe("female");
  });

  it("공용/남녀공용 쿼리에서 gender=unisex를 뽑는다", () => {
    expect(parseQuery("남녀공용 클라이밍 티").intent.gender).toBe("unisex");
  });

  it("성별 신호가 없으면 gender는 undefined다", () => {
    expect(parseQuery("검정 오버핏 티").intent.gender).toBeUndefined();
  });

  it("'여성 전용 남녀공용 말고'는 female + 공용 제외로 파싱한다", () => {
    const { intent } = parseQuery("여성 전용 상품만 보여줘 남녀공용 말고");
    expect(intent.gender).toBe("female");
    expect(intent.genderExclusive).toBe(true);
  });

  it("'여성 전용'은 female + 공용 제외", () => {
    const { intent } = parseQuery("여성 전용 클라이밍 티");
    expect(intent.gender).toBe("female");
    expect(intent.genderExclusive).toBe(true);
  });

  it("'남성만'은 male + 공용 제외", () => {
    const { intent } = parseQuery("남성만 보여줘");
    expect(intent.gender).toBe("male");
    expect(intent.genderExclusive).toBe(true);
  });

  it("공용 배제 신호가 없는 '여성 클라이밍 티'는 방향성(공용 포함)", () => {
    const { intent } = parseQuery("여성 클라이밍 티");
    expect(intent.gender).toBe("female");
    expect(intent.genderExclusive).toBeFalsy();
  });

  it("순수 '남녀공용'은 unisex(전용 아님)", () => {
    const { intent } = parseQuery("남녀공용 클라이밍 티");
    expect(intent.gender).toBe("unisex");
    expect(intent.genderExclusive).toBeFalsy();
  });

  it("공용 배제 시 성별 칩 라벨에 '전용'이 붙는다", () => {
    const { chips } = parseQuery("여성 전용 티");
    expect(chips.find((c) => c.kind === "gender")?.label).toBe("여성 전용");
  });
});
