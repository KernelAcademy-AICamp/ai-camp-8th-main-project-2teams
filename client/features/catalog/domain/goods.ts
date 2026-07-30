// 무신사 상품 도메인 엔티티 — search_goods 뷰 컬럼과 짝. 프레임워크 독립 순수 타입.
export interface Goods {
  goodsNo: string;
  styleKey: string;
  title: string;
  brand: string;
  category: string;
  gender: string; // "남성" | "여성" | "공용" (빈 문자열 가능)
  season?: string;
  color?: string; // 대표색
  colors: string[];
  patterns: string[];
  materials: string[];
  fits: string[];
  sizes: string[];
  sizeFree: boolean;
  sizeStd: number[];
  price: number;
  reviewCount: number;
  reviewScore: number;
  gallery: string[];
  url: string;
  thumbnail: string;
  // 착용감 축별 단일값. 상품은 축을 다 갖지 않으므로 partial(인덱스 접근 = string | undefined).
  wearChars: Partial<Record<string, string>>;
}
