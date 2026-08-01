// 조회 계획(설계 §3.5 QueryPlan) — 후보 하드 계획(후보 집합을 결정하는 모든 것, 해시 대상)과
// 전체 실행 계획(소프트 주석·사용자 정렬, 기준선 기록용)의 이원 구조.
// flag-off에선 현행 buildGoodsQuery와 완전 동일해야 하며(candidateCalls로 단언),
// flag-on(decisive)에선 LLM 출처 값이 하드 조건에서 배제된다(축별 소프트 소비 정책).
import { pgArray } from "@/features/search/data/build-goods-query";
import { escapeLike, orIlikeTitle } from "@/features/search/data/escape-postgrest";
import {
  type SortIntent,
  WEAR_AXES,
  type WearCharsFilter,
} from "@/features/search/domain/query-intent";
import type { ResolvedIntent } from "@/features/search/domain/resolved-intent";

const STYLE_AXES = ["colors", "patterns", "materials", "fits"] as const;
type StyleAxis = (typeof STYLE_AXES)[number];
type StyleAxes = Record<StyleAxis, string[]>;

// 고정 후보-fetch 정렬·상한 — 의도와 무관한 상수(후보 집합을 결정하므로 후보 계획에 포함).
const FETCH_ORDER = [
  ["review_score", false],
  ["goods_no", true],
] as const;
const FETCH_LIMIT = 3000;

export interface CandidateHardPlan {
  brand: string | null;
  titleTokens: string[];
  gender: string | null;
  sizeStd: number[];
  priceMin: number | null;
  priceMax: number | null;
  hardStyle: StyleAxes;
  excludeStyle: StyleAxes;
  excludeTitle: string[]; // exclude.keywords → 제목 NOT(하드)
  fetchOrder: typeof FETCH_ORDER;
  limit: typeof FETCH_LIMIT;
}

export interface ExecutionPlan {
  candidate: CandidateHardPlan;
  soft: {
    keywords: string[];
    wearChars: WearCharsFilter;
    // flag-on에서 하드→소프트로 강등된 LLM 스타일(랭킹 소비자 존재 축만).
    degradedStyle?: StyleAxes;
  };
  userSort: SortIntent; // LLM 유래 사용자 정렬 — 후보 집합 무관(해시 비대상)
}

function emptyAxes(): StyleAxes {
  return { colors: [], patterns: [], materials: [], fits: [] };
}

function metaValues(
  resolved: ResolvedIntent,
  path: string,
  pred?: (source: string) => boolean,
): (string | number)[] {
  return resolved.meta
    .filter((m) => m.path === path && (!pred || pred(m.source)))
    .map((m) => m.value);
}

export function buildQueryPlan(
  resolved: ResolvedIntent,
  { decisive }: { decisive: boolean },
): ExecutionPlan {
  const { intent } = resolved;
  const nonLlm = (s: string) => s !== "llm";

  const candidate: CandidateHardPlan = {
    brand: intent.brand ?? null,
    titleTokens: intent.titleTokens ?? [],
    gender: decisive ? null : (intent.gender ?? null),
    sizeStd: decisive ? [] : intent.sizeStd,
    priceMin: decisive
      ? ((metaValues(resolved, "priceMin", nonLlm)[0] as number | undefined) ?? null)
      : (intent.priceMin ?? null),
    priceMax: decisive
      ? ((metaValues(resolved, "priceMax", nonLlm)[0] as number | undefined) ?? null)
      : (intent.priceMax ?? null),
    hardStyle: decisive
      ? emptyAxes()
      : {
          colors: intent.style.colors,
          patterns: intent.style.patterns,
          materials: intent.style.materials,
          fits: intent.style.fits,
        },
    excludeStyle: decisive
      ? emptyAxes()
      : {
          colors: intent.exclude.colors,
          patterns: intent.exclude.patterns,
          materials: intent.exclude.materials,
          fits: intent.exclude.fits,
        },
    excludeTitle: decisive ? [] : intent.exclude.keywords,
    fetchOrder: FETCH_ORDER,
    limit: FETCH_LIMIT,
  };

  const degraded: StyleAxes = {
    colors: intent.style.colors,
    patterns: intent.style.patterns,
    materials: intent.style.materials,
    fits: intent.style.fits,
  };
  const hasDegraded = STYLE_AXES.some((a) => degraded[a].length > 0);

  return {
    candidate,
    soft: {
      keywords: intent.style.keywords,
      wearChars: WEAR_AXES.reduce<WearCharsFilter>(
        (acc, axis) => ({ ...acc, [axis]: intent.wearChars[axis] }),
        {} as WearCharsFilter,
      ),
      ...(decisive && hasDegraded ? { degradedStyle: degraded } : {}),
    },
    userSort: intent.sort,
  };
}

type Call = [string, ...unknown[]];

// 후보 계획 → 현행 쿼리 빌더가 만드는 호출열(순서 포함) — flag-off 동일성 단언의 재료.
// ⚠️ build-goods-query.ts의 적용 순서를 그대로 재현한다. 빌더가 바뀌면 이 함수와
// 동일성 테스트가 함께 깨져 표류를 잡는다(의도된 이중 기입).
export function candidateCalls(
  c: CandidateHardPlan,
  tier?: "phrase" | "and" | "or",
): Call[] {
  const calls: Call[] = [];
  if (c.brand) calls.push(["eq", "brand", c.brand]);
  if (tier && c.titleTokens.length) {
    if (tier === "phrase") {
      calls.push(["ilike", "title", `%${escapeLike(c.titleTokens.join(" "))}%`]);
    } else if (tier === "and") {
      for (const tok of c.titleTokens) {
        calls.push(["ilike", "title", `%${escapeLike(tok)}%`]);
      }
    } else {
      calls.push(["or", orIlikeTitle(c.titleTokens)]);
    }
  }
  if (c.gender) calls.push(["eq", "gender", c.gender]);
  if (c.sizeStd.length) {
    calls.push(["or", `size_std.ov.{${c.sizeStd.join(",")}},size_free.eq.true`]);
  }
  if (c.priceMin != null) calls.push(["gte", "price", c.priceMin]);
  if (c.priceMax != null) calls.push(["lte", "price", c.priceMax]);
  for (const axis of STYLE_AXES) {
    if (c.hardStyle[axis].length) calls.push(["overlaps", axis, c.hardStyle[axis]]);
  }
  for (const axis of STYLE_AXES) {
    if (c.excludeStyle[axis].length) {
      calls.push(["not", axis, "ov", pgArray(c.excludeStyle[axis])]);
    }
  }
  for (const kw of c.excludeTitle) {
    calls.push(["not", "title", "ilike", `%${escapeLike(kw)}%`]);
  }
  for (const [col, asc] of c.fetchOrder) calls.push(["order", col, asc]);
  calls.push(["limit", c.limit]);
  return calls;
}

// 후보 하드 계획의 결정성 키 — 안정적 직렬화(결정성 게이트의 해시 재료).
export function candidatePlanKey(c: CandidateHardPlan): string {
  return JSON.stringify(c);
}
