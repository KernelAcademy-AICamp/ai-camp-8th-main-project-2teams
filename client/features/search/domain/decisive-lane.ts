// 결정화 레인(flag-on) 정책 — 설계 §3.5·계획 v2.2 "flag-on의 세 가지 발효" 중
// ①grounded 신호 ②하드 조건 정책(LLM 출처 하드 불가) ③resolved 응답 계약을 담당한다.
// flag-off 경로는 이 모듈을 전혀 타지 않는다(현행 동작 보존).
import { EMPTY_INTENT, type QueryIntent } from "@/features/search/domain/query-intent";
import type { ResolvedIntent } from "@/features/search/domain/resolved-intent";

// 서버 전용 환경변수 — 값이 정확히 "on"일 때만 켜진다(기본 off, 프로덕션 P3-F 기간 off 고정).
export function isDecisiveLaneOn(env: Record<string, string | undefined>): boolean {
  return env.SEARCH_DECISIVE_LANE === "on";
}

// grounded 신호(설계 §3.5) — 결정적 출처 값이 하나 이상 있어야 검색 신호.
// 3a·3b에서 facet_lexicon·rule_parser가 추가돼도 이 판정은 그대로 유효하다.
export function hasGroundedSignal(resolved: ResolvedIntent): boolean {
  return resolved.meta.some((m) => m.source !== "llm");
}

function nonLlmPrice(
  resolved: ResolvedIntent,
  path: "priceMin" | "priceMax",
): number | undefined {
  const m = resolved.meta.find((x) => x.path === path && x.source !== "llm");
  return m ? (m.value as number) : undefined;
}

// flag-on 조회용 intent — LLM 출처 하드값 제거(facet 하드·성별·사이즈·배제·비명시 가격).
// keywords·wearChars는 조회에 안 쓰이는 소프트 재료라 유지, 정렬은 예외적으로 유지.
export function decisiveQueryIntent(resolved: ResolvedIntent): QueryIntent {
  const { intent } = resolved;
  return {
    ...intent,
    gender: undefined,
    sizeStd: [],
    priceMin: nonLlmPrice(resolved, "priceMin"),
    priceMax: nonLlmPrice(resolved, "priceMax"),
    style: { ...EMPTY_INTENT.style, keywords: intent.style.keywords },
    exclude: { ...EMPTY_INTENT.exclude },
  };
}

// flag-on 응답 intent(resolved 계약) — 실제 적용됐거나 소프트로 반영된 값만 담는다.
// 소프트 소비자 없는 축(LLM 성별·사이즈·배제·비명시 가격)은 제거 → 칩 미표시.
// 소프트 강등된 스타일(색 등)은 랭킹에 반영되므로 유지 → "적용된 조건 = 표시된 칩".
export function decisiveResponseIntent(resolved: ResolvedIntent): QueryIntent {
  const { intent } = resolved;
  return {
    ...intent,
    gender: undefined,
    sizeStd: [],
    priceMin: nonLlmPrice(resolved, "priceMin"),
    priceMax: nonLlmPrice(resolved, "priceMax"),
    exclude: { ...EMPTY_INTENT.exclude },
  };
}
