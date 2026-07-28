import { describe, expect, it } from "vitest";

import { extractReviewTags } from "@/features/search/domain/extract-review-tags";

describe("extractReviewTags", () => {
  it("긍정 품질 키워드를 태그로 뽑는다", () => {
    const r = extractReviewTags("재질 좋고 부드러운 클라이밍 티");
    expect(new Set(r.reviewTags)).toEqual(
      new Set(["재질좋음", "부드러움", "클라이밍"]),
    );
  });

  it("극성('안 ~한')은 긍정태그 + 짝 결함태그를 함께 만든다", () => {
    const r = extractReviewTags("목 안 늘어나고 안 비치는 티");
    expect(r.reviewTags).toContain("목안늘어남");
    expect(r.reviewTags).toContain("비침없음");
    expect(new Set(r.excludeTags)).toEqual(new Set(["목늘어남", "비침있음"]));
  });

  it("'옷이 튼튼'은 탄탄함, '프린팅 안 벗겨지는'은 프린팅튼튼으로 구분한다", () => {
    expect(extractReviewTags("옷이 튼튼한 티").reviewTags).toContain("탄탄함");
    expect(extractReviewTags("옷이 튼튼한 티").reviewTags).not.toContain("프린팅튼튼");
    const p = extractReviewTags("프린팅 안 벗겨지는 티");
    expect(p.reviewTags).toContain("프린팅튼튼");
    expect(p.reviewTags).not.toContain("탄탄함");
  });

  it("'세탁 후 프린팅이 변하지 않고'도 프린팅튼튼으로 잡는다", () => {
    expect(
      extractReviewTags("세탁 후 프린팅이 변하지 않고 그대로인 티").reviewTags,
    ).toContain("프린팅튼튼");
    expect(extractReviewTags("프린팅 변형 없는 티").reviewTags).toContain("프린팅튼튼");
  });

  it("'목이 넉넉한'은 넥라인넉넉(넉넉핏 아님)으로 우선 매칭한다", () => {
    const r = extractReviewTags("목이 넉넉한 티");
    expect(r.reviewTags).toContain("넥라인넉넉");
    expect(r.reviewTags).not.toContain("넉넉핏");
  });

  it("'목이 조이지 않는'은 넥라인넉넉으로(좁음 아님) — 부정 처리", () => {
    const r = extractReviewTags("목이 조이지 않는 티");
    expect(r.reviewTags).toContain("넥라인넉넉");
    expect(r.reviewTags).not.toContain("넥라인좁음");
  });

  it("'목이 조이는'(부정 없음)은 넥라인좁음으로 잡는다", () => {
    const r = extractReviewTags("목이 조이는 티");
    expect(r.reviewTags).toContain("넥라인좁음");
    expect(r.reviewTags).not.toContain("넥라인넉넉");
  });

  it("냉감·통풍은 functional, 흡습속건은 reviewTags로 간다", () => {
    const r = extractReviewTags("시원하고 바람 잘 통하고 땀 빨리 마르는 티");
    expect(new Set(r.functional)).toEqual(new Set(["냉감", "통풍"]));
    expect(r.reviewTags).toContain("흡습속건");
  });

  it("순수 결함 회피는 excludeTags로만 간다", () => {
    const r = extractReviewTags("택 안 따가운 티");
    expect(r.excludeTags).toContain("택따가움");
    expect(r.reviewTags).toEqual([]);
  });

  it("매칭 없으면 모두 빈 배열", () => {
    const r = extractReviewTags("빨간 반팔 티셔츠");
    expect(r).toEqual({ reviewTags: [], excludeTags: [], functional: [] });
  });

  it("'두께 적당'은 두께적당, 도톰·얇음으로 오염되지 않는다", () => {
    const r = extractReviewTags("두께 적당한 티");
    expect(r.reviewTags).toEqual(["두께적당"]);
  });

  it("ㅂ불규칙 어간(귀엽고·부드럽고·안 무겁고)도 잡는다", () => {
    expect(extractReviewTags("귀엽고 예쁜 티").reviewTags).toContain("디자인귀여움");
    expect(extractReviewTags("부드럽고 얇은 티").reviewTags).toContain("부드러움");
    const light = extractReviewTags("안 무겁고 시원한 티");
    expect(light.reviewTags).toContain("가벼움");
    expect(light.excludeTags).toContain("무거움");
  });

  it("'화면이랑 색 똑같고'도 화면색상일치로 잡는다", () => {
    const r = extractReviewTags("화면이랑 색 똑같고 발색 좋은 티");
    expect(r.reviewTags).toContain("화면색상일치");
    expect(r.excludeTags).toContain("화면과색상다름");
  });

  it("부분문자열 오탐을 만들지 않는다(쿨톤·아이스크림·따뜻한 색감)", () => {
    // 쿨톤(피부톤)≠냉감, 아이스크림(그래픽)≠냉감·아동, 따뜻한 색감(색)≠따뜻함
    expect(extractReviewTags("쿨톤 어울리는 티").functional).not.toContain("냉감");
    const ice = extractReviewTags("아이스크림 그래픽 티");
    expect(ice.functional).not.toContain("냉감");
    expect(ice.reviewTags).not.toContain("아동·학생용");
    expect(extractReviewTags("따뜻한 색감 파스텔 티").reviewTags).not.toContain(
      "따뜻함",
    );
  });

  it("정상 냉감/아동/따뜻함은 여전히 잡는다(과교정 방지)", () => {
    expect(extractReviewTags("쿨한 냉감 티").functional).toContain("냉감");
    expect(extractReviewTags("아이들 키즈 티").reviewTags).toContain("아동·학생용");
    expect(extractReviewTags("따뜻한 기모 티").reviewTags).toContain("따뜻함");
  });

  it("의태어를 표준 태그로 매핑한다(부드부드·쫀쫀·하늘하늘)", () => {
    expect(extractReviewTags("부드부드한 티").reviewTags).toContain("부드러움");
    expect(extractReviewTags("보들보들 부들부들 티").reviewTags).toContain("부드러움");
    expect(extractReviewTags("쫀쫀한 원단 티").reviewTags).toContain("탄탄함");
    expect(extractReviewTags("하늘하늘한 티").reviewTags).toContain("얇음");
  });

  it("두께 부정을 반대 태그로 뒤집는다(안 얇은→도톰, 도톰하지 않은→얇음)", () => {
    const thick = extractReviewTags("안 얇은 티");
    expect(thick.reviewTags).toContain("도톰함");
    expect(thick.reviewTags).not.toContain("얇음");
    const thin = extractReviewTags("도톰하지 않은 티");
    expect(thin.reviewTags).toContain("얇음");
    expect(thin.reviewTags).not.toContain("도톰함");
    // '두꺼운'도 도톰함으로
    expect(extractReviewTags("두꺼운 티").reviewTags).toContain("도톰함");
  });

  it("'안 넉넉한 핏'은 슬림핏으로(넉넉핏 아님)", () => {
    const r = extractReviewTags("안 넉넉한 핏 티");
    expect(r.reviewTags).toContain("슬림핏");
    expect(r.reviewTags).not.toContain("넉넉핏");
  });

  it("긴 부정형('~지 않')도 짧은 부정형처럼 잡는다", () => {
    // "안 X"뿐 아니라 "X지 않"도 커버
    const pairs: [string, string][] = [
      ["비치지 않는 티", "비침없음"],
      ["프린팅 벗겨지지 않는 티", "프린팅튼튼"],
      ["보풀 생기지 않는 티", "보풀안생김"],
      ["물 빠지지 않는 티", "물빠짐"],
    ];
    for (const [q, tag] of pairs) {
      const r = extractReviewTags(q);
      expect([...r.reviewTags, ...r.excludeTags]).toContain(tag);
    }
  });

  it("무게감 표현을 가벼움으로 매핑한다(무게감 적은/없는/무게 안 나가는)", () => {
    expect(extractReviewTags("무게감이 적은 티").reviewTags).toContain("가벼움");
    expect(extractReviewTags("무게감 없는 티").reviewTags).toContain("가벼움");
    expect(extractReviewTags("무게 안 나가는 티").reviewTags).toContain("가벼움");
    // '무게감 있는'은 가벼움이 아니다(오탐 방지)
    expect(extractReviewTags("무게감 있는 티").reviewTags).not.toContain("가벼움");
  });
});
