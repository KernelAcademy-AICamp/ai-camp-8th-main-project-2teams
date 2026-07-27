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
    const label = intent.genderExclusive
      ? `${GENDER_LABEL[intent.gender]} 전용`
      : GENDER_LABEL[intent.gender];
    chips.push({ label, kind: "gender" });
  }
  for (const fn of intent.functional) {
    chips.push({ label: fn, kind: "functional" });
  }
  for (const tag of intent.reviewTags ?? []) {
    chips.push({ label: tag, kind: "reviewTag" });
  }
  for (const tag of intent.excludeTags ?? []) {
    // label은 원본 태그 그대로 — 제거 시 매칭에 쓴다. "제외" 표기는 View에서.
    chips.push({ label: tag, kind: "exclude" });
  }

  // 같은 라벨 중복 제거(예: fit "오버핏" + 리뷰태그 "오버핏"). 먼저 온 칩을 유지.
  const seen = new Set<string>();
  return chips.filter((c) => {
    if (seen.has(c.label)) return false;
    seen.add(c.label);
    return true;
  });
}
