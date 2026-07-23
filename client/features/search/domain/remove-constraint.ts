// 유스케이스: 의도칩(IntentChip) 하나를 Intent에서 제거. 순수 함수(불변).
import type { Intent, IntentChip } from "@/features/search/domain/intent";

export function removeConstraintFromIntent(intent: Intent, chip: IntentChip): Intent {
  switch (chip.kind) {
    case "base":
      return { ...intent, baseColor: undefined };
    case "print":
      return { ...intent, printColor: undefined };
    case "position":
      return { ...intent, printPosition: undefined };
    case "fit":
      return { ...intent, fit: undefined };
    case "graphic":
      return { ...intent, graphicType: undefined };
    case "brand":
      return { ...intent, brand: undefined };
    case "gender":
      return { ...intent, gender: undefined, genderExclusive: undefined };
    case "functional":
      return {
        ...intent,
        functional: intent.functional.filter((f) => f !== chip.label),
      };
    default:
      return intent;
  }
}
