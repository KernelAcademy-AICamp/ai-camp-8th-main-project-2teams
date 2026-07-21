// 도메인 엔티티 — 프레임워크/데이터소스 독립. 순수 타입과 상수만.

export type ColorKey =
  | "흰"
  | "검정"
  | "회색"
  | "네이비"
  | "노랑"
  | "빨강"
  | "파랑"
  | "초록"
  | "주황"
  | "분홍"
  | "보라";

export const COLOR_HEX: Record<ColorKey, string> = {
  흰: "#ffffff",
  검정: "#1a1b1f",
  회색: "#9ca3af",
  네이비: "#1e293b",
  노랑: "#f5c518",
  빨강: "#ef4444",
  파랑: "#3b82f6",
  초록: "#22c55e",
  주황: "#ff7a2f",
  분홍: "#ff7aa2",
  보라: "#8b5cf6",
};

export type PrintPosition = "앞" | "뒤" | "양면";
export type GraphicType = "레터링" | "캐릭터" | "로고" | "패턴" | "그래픽";
export type Fit = "오버" | "레귤러" | "슬림";
export type Material = "면" | "폴리" | "기능성";

export interface Tee {
  id: string;
  name: string;
  brand: string;
  price: number;
  mall: string;
  baseColor: ColorKey;
  printColor: ColorKey;
  printPosition: PrintPosition;
  graphicType: GraphicType;
  fit: Fit;
  material: Material;
  functional: string[]; // 냉감 · 통풍 · 신축 · 흡습속건
  sizes: string[]; // ["S","M","L","XL"] 또는 ["프리"]
}
