// Route Handler — 무신사 구조화 검색. LLM 파싱 ∥ lexical 브랜드 매칭 → 하드필터 → 소프트 랭킹.
// ⚠️ 서버 전용. mode 계약(설계 §4.4): 신호 없으면 파서 성공 여부 무관 failed(일반 상위 노출 금지).
import { createClient } from "@supabase/supabase-js";

import type { Goods } from "@/features/catalog/domain/goods";
import {
  type AliasDb,
  getSafeBrandAliases,
} from "@/features/search/data/brand-alias-repository";
import {
  buildGoodsQuery,
  type GoodsQuery,
  type TitleTier,
} from "@/features/search/data/build-goods-query";
import { mapGoodsRow, type SearchGoodsRow } from "@/features/search/data/map-goods-row";
import { parseQueryIntent } from "@/features/search/data/parse-query-intent";
import {
  decisiveQueryIntent,
  decisiveResponseIntent,
  hasGroundedSignal,
  isDecisiveLaneOn,
} from "@/features/search/domain/decisive-lane";
import { extractExplicitPrice } from "@/features/search/domain/extract-explicit-price";
import { extractTitleTokens } from "@/features/search/domain/extract-title-tokens";
import { matchBrandDetailed } from "@/features/search/domain/match-brand";
import { pickColorImage } from "@/features/search/domain/pick-color-image";
import { EMPTY_INTENT, type QueryIntent } from "@/features/search/domain/query-intent";
import { rankGoods } from "@/features/search/domain/rank-goods";
import { resolveIntent } from "@/features/search/domain/resolved-intent";
import {
  hasNonTitleHardFilters,
  hasStyleHardFilters,
  stripStyleHardFilters,
} from "@/features/search/domain/salvage-intent";
import {
  deriveSearchMode,
  type SearchMode,
} from "@/features/search/domain/search-mode";

export const maxDuration = 30;

// 결과 상한. 실질 상한은 Supabase PostgREST max_rows(=1000, backend/supabase/config.toml)라
// 이 값을 그 이상으로 올려도 DB 후보가 최대 ~1000건이다(그 이상은 페이지네이션 = Phase 1.5b).
const RESULT_LIMIT = 1000;

const SEARCH_SUMMARY_COLUMNS =
  "goods_no,style_key,title,brand,category,gender,season,color,colors,patterns," +
  "materials,fits,sizes,size_free,size_std,price,review_count,review_score,url,thumbnail,wear_chars," +
  "color_images";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

function readQuery(body: unknown): string {
  if (typeof body !== "object" || body === null) return "";
  const q = (body as Record<string, unknown>).query;
  return typeof q === "string" ? q.trim() : "";
}

interface SearchPayload {
  results: Goods[];
  intent: QueryIntent;
  mode: SearchMode;
  titleTier: TitleTier | null;
  titleSalvage: boolean;
  titleDropped: boolean;
}

function failed(intent: QueryIntent): Response {
  return Response.json({
    results: [],
    intent,
    mode: "failed",
    titleTier: null,
    titleSalvage: false,
    titleDropped: false,
  } satisfies SearchPayload);
}

export async function POST(request: Request): Promise<Response> {
  const body: unknown = await request.json().catch(() => null);
  const query = readQuery(body);
  if (!query) return failed(EMPTY_INTENT);
  if (!SUPABASE_URL || !SUPABASE_KEY) return failed(EMPTY_INTENT);

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // 1) LLM 파싱(semantic 레인) — 계약 불변.
  const { intent: parsedIntent, degraded: parserDegraded } =
    await parseQueryIntent(query);

  // 1b) 결정적 가격 파서(설계 P0-①) — 통화 단위가 명시된 가격 표현이 있으면 LLM의
  //     priceMin/Max 환각(예: "2만원 이하"→2000원으로 오파싱)을 결정적 결과로 전량 대체한다.
  //     미발견 시 LLM 값 유지.
  const explicitPrice = extractExplicitPrice(query);
  let intent = parsedIntent;
  if (explicitPrice) {
    intent = {
      ...intent,
      priceMin: explicitPrice.priceMin,
      priceMax: explicitPrice.priceMax,
    };
  }

  const decisive = isDecisiveLaneOn(process.env);

  // 2) lexical 브랜드 레이어 — safe alias만 로드하므로 매칭 성공 = safe(불변식).
  //    사전 조회 실패 → failed(설계 §4.4). flag-on이면 오류 경로도 resolved 응답 계약 준수.
  try {
    // supabase-js 클라이언트는 AliasDb를 구조적으로 만족(제네릭 차이만 캐스트로 흡수).
    // eslint 타입체커는 단일 캐스트를 불필요하다고 보지만, tsc --noEmit은 단일 캐스트에서
    // TS2589(과도한 타입 인스턴스화)로 실패한다. `as unknown as`로 우회.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const aliases = await getSafeBrandAliases(supabase as unknown as AliasDb);
    const brandMatch = matchBrandDetailed(query, aliases);
    if (brandMatch) intent = { ...intent, brand: brandMatch.brand };
    const titleTokens = extractTitleTokens(query, brandMatch?.consumedTokens ?? []);
    if (titleTokens.length) intent = { ...intent, titleTokens };
  } catch {
    return failed(
      decisive
        ? decisiveResponseIntent(
            resolveIntent({ intent, explicitPrice: explicitPrice !== null }),
          )
        : intent,
    );
  }

  // 2b) provenance 해석(P3-F) — 값 단위 출처 메타. flag-off에선 관측 준비일 뿐 동작 불변.
  const resolved = resolveIntent({ intent, explicitPrice: explicitPrice !== null });
  // flag-on 전용: 응답은 resolved 계약(미적용 LLM 값 제거), 조회는 하드 정책 적용.
  let responseIntent = decisive ? decisiveResponseIntent(resolved) : intent;
  if (decisive) intent = decisiveQueryIntent(resolved);
  const respIntent = (): QueryIntent => (decisive ? responseIntent : intent);
  // flag-off 랭킹은 조회 intent 그대로(현행과 참조 동일) / flag-on은 소프트 강등분을
  // 반영하기 위해 responseIntent(색 등 유지)로 랭킹한다.
  const rankIntentOf = (forIntent: QueryIntent): QueryIntent =>
    decisive ? responseIntent : forIntent;

  // 3) mode 판정 — 신호 없으면 DB 조회 없이 failed(일반 상위 상품 노출 금지).
  //    flag-on: grounded 신호(결정적 출처 ≥1)만 신호로 인정(설계 §3.5, v2.1 명문화 ②).
  const mode: SearchMode = decisive
    ? hasGroundedSignal(resolved)
      ? parserDegraded
        ? "lexical_only"
        : "full"
      : "failed"
    : deriveSearchMode(parserDegraded, intent);
  if (mode === "failed") return failed(respIntent());

  // 4) 하드 필터 쿼리(브랜드 eq 포함) → 후보 페치 → 소프트 랭킹.
  //    제목 잔여 토큰이 있으면 phrase→and→or tier 순으로 폴백(설계 §9-2).
  const TITLE_TARGET = 24; // 다른 하드필터 적용 후 고유 상품 24개면 폴백 중단
  const TIERS: TitleTier[] = ["phrase", "and", "or"];

  const fetchTier = async (forIntent: QueryIntent, tier?: TitleTier) => {
    const base = supabase
      .from("search_goods")
      .select(SEARCH_SUMMARY_COLUMNS) as unknown as GoodsQuery;
    return await (buildGoodsQuery(base, forIntent, tier) as unknown as PromiseLike<{
      data: SearchGoodsRow[] | null;
      error: unknown;
    }>);
  };

  // 제목 tier 폴백 — 상위 tier 우선 배치, goods_no dedup, 24개 채우면 중단.
  // 재사용: 원본 intent와 제목 0건 구제(salvage) intent 양쪽 스윕에 쓴다(설계 §4.4).
  const sweepTitleTiers = async (
    forIntent: QueryIntent,
  ): Promise<{
    results: Goods[];
    titleTier: TitleTier | null;
    uniqueCount: number;
  } | null> => {
    const seen = new Set<string>();
    const groups: Goods[][] = [];
    let titleTier: TitleTier | null = null;
    for (const tier of TIERS) {
      const { data, error } = await fetchTier(forIntent, tier);
      if (error || !data) return null;
      titleTier = tier;
      const fresh = data.map(mapGoodsRow).filter((g) => {
        if (seen.has(g.goodsNo)) return false;
        seen.add(g.goodsNo);
        return true;
      });
      if (fresh.length)
        groups.push(rankGoods(fresh, rankIntentOf(forIntent), RESULT_LIMIT));
      if (seen.size >= TITLE_TARGET) break;
    }
    return {
      results: groups.flat().slice(0, RESULT_LIMIT),
      titleTier,
      uniqueCount: seen.size,
    };
  };

  let results: Goods[];
  let titleTier: TitleTier | null = null;
  let titleSalvage = false;
  let titleDropped = false;

  if (intent.titleTokens?.length) {
    const sweep = await sweepTitleTiers(intent);
    if (!sweep) return failed(respIntent());
    results = sweep.results;
    titleTier = sweep.titleTier;
    let uniqueCount = sweep.uniqueCount;

    // 제목 0건 구제(v3.2, 사용자 승인) — 전 tier 0건 && LLM 유래 스타일 하드필터/exclude
    // 존재 시, 그걸 뺀 intent로 1회만 재스윕. 성공하면 결과·intent를 교체(칩 반영).
    if (uniqueCount === 0 && hasStyleHardFilters(intent)) {
      titleSalvage = true;
      const salvageIntent = stripStyleHardFilters(intent);
      const salvageSweep = await sweepTitleTiers(salvageIntent);
      if (!salvageSweep) return failed(respIntent());
      uniqueCount = salvageSweep.uniqueCount;
      if (salvageSweep.uniqueCount > 0) {
        results = salvageSweep.results;
        titleTier = salvageSweep.titleTier;
        intent = salvageIntent;
      }
    }

    // titleTokens 폐기 fallback(P0-②) — strict 스윕·style-strip 구제가 둘 다 0건이면
    // 제목 하드 게이트가 대화 필러를 오탐(예: "내가 105 입는데…")했을 가능성이 있다.
    // 다른 비제목 하드 조건이 실제로 남아있을 때만(hasNonTitleHardFilters), 제목 토큰을
    // 통째로 뺀 원본 intent로 Phase 1 단일 쿼리(tier 없음) 1회 재시도한다.
    if (uniqueCount === 0 && hasNonTitleHardFilters(intent)) {
      const intentNoTitle: QueryIntent = { ...intent, titleTokens: [] };
      const { data, error } = await fetchTier(intentNoTitle);
      if (error || !data) return failed(respIntent());
      // 폐기된 titleTokens는 랭킹에도 무영향이어야 한다 — flag-on 랭킹 intent에서도 제거.
      const dropRankIntent = decisive
        ? { ...responseIntent, titleTokens: [] }
        : intentNoTitle;
      const dropped = rankGoods(data.map(mapGoodsRow), dropRankIntent, RESULT_LIMIT);
      if (dropped.length > 0) {
        results = dropped;
        titleTier = null;
        intent = intentNoTitle;
        if (decisive) responseIntent = { ...responseIntent, titleTokens: [] };
        titleDropped = true;
      }
    }
  } else {
    const { data, error } = await fetchTier(intent);
    if (error || !data) return failed(respIntent());
    results = rankGoods(data.map(mapGoodsRow), rankIntentOf(intent), RESULT_LIMIT);
  }

  // 표시 이미지 선택(조언 층) — 검색 의도 색으로 색별 이미지를 고른다.
  //   · results 순서·랭킹·mode엔 영향 없음(순수 후처리).
  //   · 색별 이미지 맵(colorImages)은 응답에서 제거하고 고른 1장(displayImage)만 내려보낸다.
  const finalIntent = respIntent();
  const withDisplay: Goods[] = results.map((g) => {
    const displayImage =
      pickColorImage(
        g.colorImages,
        finalIntent.style.colors,
        finalIntent.exclude.colors,
      ) ?? undefined;
    return { ...g, colorImages: undefined, displayImage };
  });

  return Response.json({
    results: withDisplay,
    intent: finalIntent,
    mode,
    titleTier,
    titleSalvage,
    titleDropped,
  } satisfies SearchPayload);
}
