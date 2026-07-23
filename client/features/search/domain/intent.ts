// 검색 의도 — 자연어 쿼리가 파싱된 결과. 도메인 타입.
import type {
  ColorKey,
  Fit,
  Gender,
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
  gender?: Gender; // 쿼리에서 파싱된 성별 의도. 없으면 제약 없음.
  genderExclusive?: boolean; // "여성 전용/공용 말고"처럼 공용을 제외하라는 신호. 기본(false)은 방향성(공용 포함).
}

export interface IntentChip {
  label: string;
  kind:
    | "base"
    | "print"
    | "position"
    | "fit"
    | "functional"
    | "graphic"
    | "brand"
    | "gender";
  color?: ColorKey;
}
