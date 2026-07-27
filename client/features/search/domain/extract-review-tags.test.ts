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

  it("'목이 넉넉한'은 넥라인넉넉(넉넉핏 아님)으로 우선 매칭한다", () => {
    const r = extractReviewTags("목이 넉넉한 티");
    expect(r.reviewTags).toContain("넥라인넉넉");
    expect(r.reviewTags).not.toContain("넉넉핏");
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
});
