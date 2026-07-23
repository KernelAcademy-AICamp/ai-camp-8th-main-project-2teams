// 검색 의도 — 자연어 쿼리가 파싱된 결과. 도메인 타입.
import type {
  ColorKey,
  Fit,
  GraphicType,
  PrintPosition,
} from "@/features/catalog/domain/tee";

export interface Intent {
  baseColor?: ColorKey;
  printColor?: ColorKey;
  printPosition?: PrintPosition;
  fit?: Fit;
  functional: string[];
  graphicType?: GraphicType;
  brand?: string; // 사전 매칭된 canonical 브랜드
}

export interface IntentChip {
  label: string;
  kind: "base" | "print" | "position" | "fit" | "functional" | "graphic" | "brand";
  color?: ColorKey;
}
