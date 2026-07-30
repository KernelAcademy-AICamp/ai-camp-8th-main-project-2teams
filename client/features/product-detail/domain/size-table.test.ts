import { describe, expect, it } from "vitest";

import type { SizeMeasureRow } from "@/features/catalog/domain/goods";
import { buildSizeTable } from "@/features/product-detail/domain/size-table";

const rows: SizeMeasureRow[] = [
  {
    name: "화이트 M",
    items: [
      { name: "총장", value: 66 },
      { name: "소매길이", value: 0 },
    ],
  },
  {
    name: "화이트 L",
    items: [
      { name: "총장", value: 70 },
      { name: "어깨너비", value: 550 },
    ],
  },
  { name: "블랙 M", items: [{ name: "총장", value: 67 }] },
];

describe("buildSizeTable", () => {
  it("대표색 행만 고르고 열은 union", () => {
    const t = buildSizeTable(rows, "화이트");
    expect(t.rows.map((r) => r.name)).toEqual(["화이트 M", "화이트 L"]);
    expect(t.cols).toEqual(["총장", "소매길이", "어깨너비"]);
  });
  it("<=0·>120은 null로 위생처리", () => {
    const t = buildSizeTable(rows, "화이트");
    const wM = t.rows.find((r) => r.name === "화이트 M");
    const wL = t.rows.find((r) => r.name === "화이트 L");
    expect(wM?.cells[0]).toBe(66); // 총장
    expect(wM?.cells[1]).toBeNull(); // 소매길이 0 → null
    expect(wL?.cells[2]).toBeNull(); // 어깨너비 550 → null
  });
  it("색 매칭 없으면 전체 폴백", () => {
    expect(buildSizeTable(rows, "그린").rows).toHaveLength(3);
  });
  it("색 미지정이면 전체", () => {
    expect(buildSizeTable(rows).rows).toHaveLength(3);
  });
});
