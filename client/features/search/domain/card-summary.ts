// 카드 호버 요약 — Goods에서 비교에 쓸 핵심 속성(색·패턴·핏·소재·착용감·성별)을 표시 행으로.
// 순수 함수(프레임워크 독립). 값이 있는 축만, 고정 순서로 반환하고 길이를 제한한다.
import type { Goods } from "@/features/catalog/domain/goods";
import { WEAR_AXES } from "@/features/search/domain/query-intent";

export interface SummaryRow {
  label: string;
  value: string;
}

// 좁은 2열 카드라 축당 표시 개수를 제한하고 초과분은 +N으로 접는다.
const MAX_ITEMS = 3;

function joinCapped(items: string[]): string {
  const clean = items.filter((s) => s.trim() !== "");
  if (clean.length === 0) return "";
  const shown = clean.slice(0, MAX_ITEMS);
  const extra = clean.length - shown.length;
  return extra > 0 ? `${shown.join(" · ")} +${extra}` : shown.join(" · ");
}

export function cardSummary(goods: Goods): SummaryRow[] {
  const rows: SummaryRow[] = [];
  const push = (label: string, items: string[]): void => {
    const value = joinCapped(items);
    if (value) rows.push({ label, value });
  };

  push("색", goods.colors);
  push("패턴", goods.patterns);
  push("핏", goods.fits);
  push("소재", goods.materials);

  // 착용감: WEAR_AXES 순서로 "축 값" 쌍. 객체 키 순서를 믿지 않고, 미지 키·빈 값은 제외.
  const wear = WEAR_AXES.flatMap((axis) => {
    const v = goods.wearChars[axis];
    return v && v.trim() !== "" ? [`${axis} ${v}`] : [];
  });
  push("착용감", wear);

  push("성별", [goods.gender]);

  return rows;
}
