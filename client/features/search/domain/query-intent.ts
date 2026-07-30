// 무신사 검색 의도 — LLM 출력 계약. 도메인 타입.
export type SortIntent = "relevance" | "price_asc" | "review_count";

// 소프트 스타일 필터. 각 배열은 통제 어휘(enum)에서 0..N개 (keywords만 자유어).
export interface StyleFilter {
  colors: string[];
  patterns: string[];
  materials: string[];
  fits: string[];
  keywords: string[];
}

export interface QueryIntent {
  // 코어 = 하드 필터
  gender?: "남성" | "여성" | "공용";
  sizeStd: number[];
  priceMin?: number;
  priceMax?: number;
  // 스타일 = 소프트 랭킹
  style: StyleFilter;
  // 자율권 신호
  promote: (keyof StyleFilter)[]; // 소프트→하드 승격(값 하나라도 보유 요구)
  exclude: StyleFilter; // NOT 필터
  sort: SortIntent;
}

function emptyStyle(): StyleFilter {
  return { colors: [], patterns: [], materials: [], fits: [], keywords: [] };
}

export const EMPTY_INTENT: QueryIntent = {
  sizeStd: [],
  style: emptyStyle(),
  promote: [],
  exclude: emptyStyle(),
  sort: "relevance",
};
