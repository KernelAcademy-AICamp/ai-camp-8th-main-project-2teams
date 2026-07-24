import { describe, expect, it } from "vitest";

import { mapSearchRow, type SearchRow } from "@/features/search/data/search-response";

const ROW: SearchRow = {
  id: "1",
  title: "홀로그램 곰 티",
  brand: "포텐셜",
  maker: null,
  mall_name: "스토어",
  lprice: 25000,
  link: "http://x",
  image_url: "http://img",
  gender: "unisex",
  base_color: "흰",
  print_color: null,
  print_position: null,
  graphic_type: "캐릭터",
  fit: null,
  material: null,
  functional: ["냉감"],
  sizes: ["M", "L"],
  brand_canonical: "포텐셜",
  score: 0.87,
};

describe("mapSearchRow", () => {
  it("RPC flat 행을 Tee로 매핑한다", () => {
    const t = mapSearchRow(ROW);
    expect(t.id).toBe("1");
    expect(t.name).toBe("홀로그램 곰 티");
    expect(t.brandCanonical).toBe("포텐셜");
    expect(t.baseColor).toBe("흰");
    expect(t.graphicType).toBe("캐릭터");
    expect(t.functional).toEqual(["냉감"]);
  });

  it("허용값 밖 속성은 undefined로 강등한다", () => {
    const t = mapSearchRow({ ...ROW, base_color: "형광", graphic_type: null });
    expect(t.baseColor).toBeUndefined();
    expect(t.graphicType).toBeUndefined();
  });
});
