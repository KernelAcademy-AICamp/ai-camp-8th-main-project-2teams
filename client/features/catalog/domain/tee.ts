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

// 런타임 검증용 상수 — LLM 출력이 허용값인지 확인할 때 사용 (타입은 컴파일 시 소거되므로 별도 필요).
export const COLOR_KEYS = Object.keys(COLOR_HEX) as ColorKey[];
export const PRINT_POSITIONS: readonly PrintPosition[] = ["앞", "뒤", "양면"];
export const GRAPHIC_TYPES: readonly GraphicType[] = [
  "레터링",
  "캐릭터",
  "로고",
  "패턴",
  "그래픽",
];
export const FITS: readonly Fit[] = ["오버", "레귤러", "슬림"];
export const FUNCTIONALS: readonly string[] = ["냉감", "통풍", "신축", "흡습속건"];
export const MATERIALS: readonly Material[] = ["면", "폴리", "기능성"];

export interface Tee {
  id: string;
  name: string;
  brand: string;
  brandCanonical?: string; // 사전 매칭된 통합 브랜드(검색축). 없으면 미상.
  price: number;
  mall: string;
  link: string; // 상품 페이지(몰) URL — 구매 진입(outbound) 대상
  image?: string; // 실상품 사진 URL(Supabase image_url). 없으면 합성 swatch로 폴백.
  // ── 추출 속성: 추출 파이프라인 전이라 NULL일 수 있음 → optional. 값 있을 때만 UI 표기. ──
  baseColor?: ColorKey;
  printColor?: ColorKey;
  printPosition?: PrintPosition;
  graphicType?: GraphicType;
  fit?: Fit;
  material?: Material;
  functional: string[]; // 냉감 · 통풍 · 신축 · 흡습속건 (없으면 [])
  sizes: string[]; // ["S","M","L","XL"] 또는 ["프리"] (없으면 [])
}
