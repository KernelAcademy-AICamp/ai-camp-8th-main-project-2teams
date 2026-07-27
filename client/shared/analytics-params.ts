// 이벤트 파라미터 가공 — node 환경 단위 테스트 가능한 순수 함수만 둔다(DOM/GA 접근 금지).
import type { Intent } from "@/features/search/domain/intent";
import type { SearchResult } from "@/features/search/domain/search-tees";

export type ResultType = "exact" | "partial" | "none";
export type EntryType = "typed" | "example_chip" | "direct";

export function deriveResultType(result: SearchResult): ResultType {
  if (result.exact.length > 0) return "exact";
  if (result.partial.length > 0) return "partial";
  return "none";
}

// GA4는 중첩 객체를 못 받으므로 속성별로 펼친다. 값 없는 속성은 생략.
export function flattenParsedAttributes(intent: Intent): Record<string, string> {
  const out: Record<string, string> = {};
  if (intent.baseColor) out.parsed_base_color = intent.baseColor;
  if (intent.printColor) out.parsed_print_color = intent.printColor;
  if (intent.printPosition) out.parsed_print_position = intent.printPosition;
  if (intent.fit) out.parsed_fit = intent.fit;
  if (intent.graphicType) out.parsed_graphic = intent.graphicType;
  if (intent.brand) out.parsed_brand = intent.brand;
  if (intent.gender) out.parsed_gender = intent.gender;
  if (intent.functional.length > 0) out.parsed_functional = intent.functional.join(",");
  return out;
}

export function hasParsedConstraint(intent: Intent): boolean {
  return Object.keys(flattenParsedAttributes(intent)).length > 0;
}

export function entryTypeFromSrc(src: string | null): EntryType {
  if (src === "typed") return "typed";
  if (src === "chip") return "example_chip";
  return "direct";
}
