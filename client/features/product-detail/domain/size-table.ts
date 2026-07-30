// 무신사 상품 사이즈 표 순수 변환 — size_measures → 표시용 표.
// 대표색 필터 + 값 위생처리(0·음수·>120 제거) + 열 union.

import type { SizeMeasureRow } from "@/features/catalog/domain/goods";

const MIN_CM = 0; // 초과여야 유효(0/음수는 결측 sentinel)
const MAX_CM = 120; // 상의 실측 상한 — 초과는 오류/단위이상으로 간주해 숨김

export interface SizeTable {
  cols: string[];
  rows: { name: string; cells: (number | null)[] }[];
}

function sane(v: number): number | null {
  return v > MIN_CM && v <= MAX_CM ? v : null;
}

export function buildSizeTable(rows: SizeMeasureRow[], color?: string): SizeTable {
  const matched = color ? rows.filter((r) => r.name.includes(color)) : rows;
  const use = matched.length > 0 ? matched : rows;

  const cols: string[] = [];
  for (const r of use) {
    for (const it of r.items) {
      if (!cols.includes(it.name)) cols.push(it.name);
    }
  }
  return {
    cols,
    rows: use.map((r) => ({
      name: r.name,
      cells: cols.map((c) => {
        const it = r.items.find((i) => i.name === c);
        return it ? sane(it.value) : null;
      }),
    })),
  };
}
