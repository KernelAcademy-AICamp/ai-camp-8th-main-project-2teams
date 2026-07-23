// 유스케이스: 검색 의도(Intent) → 화면에 표시할 의도칩(IntentChip). 순수 함수.
// 파싱 경로(LLM/규칙)와 무관하게 칩 생성 로직을 한곳에 모은다.
import { GENDER_LABEL } from "@/features/catalog/domain/tee";
import type { Intent, IntentChip } from "@/features/search/domain/intent";

const POSITION_LABEL: Record<string, string> = {
  뒤: "등판",
  앞: "앞면",
  양면: "양면",
};

export function intentToChips(intent: Intent): IntentChip[] {
  const chips: IntentChip[] = [];

  if (intent.printPosition) {
    chips.push({
      label: POSITION_LABEL[intent.printPosition] ?? intent.printPosition,
      kind: "position",
    });
  }
  if (intent.printColor) {
    chips.push({
      label: `${intent.printColor} 프린팅`,
      kind: "print",
      color: intent.printColor,
    });
  }
  if (intent.baseColor) {
    chips.push({
      label: `${intent.baseColor} 바탕`,
      kind: "base",
      color: intent.baseColor,
    });
  }
  if (intent.fit) {
    chips.push({ label: `${intent.fit}핏`, kind: "fit" });
  }
  if (intent.graphicType) {
    chips.push({ label: intent.graphicType, kind: "graphic" });
  }
  if (intent.brand) {
    chips.push({ label: intent.brand, kind: "brand" });
  }
  if (intent.gender) {
    chips.push({ label: GENDER_LABEL[intent.gender], kind: "gender" });
  }
  for (const fn of intent.functional) {
    chips.push({ label: fn, kind: "functional" });
  }

  return chips;
}
