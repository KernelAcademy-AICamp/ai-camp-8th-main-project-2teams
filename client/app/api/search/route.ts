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
} from "@/features/search/data/build-goods-query";
import { mapGoodsRow, type SearchGoodsRow } from "@/features/search/data/map-goods-row";
import { parseQueryIntent } from "@/features/search/data/parse-query-intent";
import { matchBrand } from "@/features/search/domain/match-brand";
import { EMPTY_INTENT, type QueryIntent } from "@/features/search/domain/query-intent";
import { rankGoods } from "@/features/search/domain/rank-goods";
import {
  deriveSearchMode,
  type SearchMode,
} from "@/features/search/domain/search-mode";

export const maxDuration = 30;

const SEARCH_SUMMARY_COLUMNS =
  "goods_no,style_key,title,brand,category,gender,season,color,colors,patterns," +
  "materials,fits,sizes,size_free,size_std,price,review_count,review_score,url,thumbnail,wear_chars";

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
}

function failed(intent: QueryIntent): Response {
  return Response.json({ results: [], intent, mode: "failed" } satisfies SearchPayload);
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

  // 2) lexical 브랜드 레이어 — safe alias만 로드하므로 매칭 성공 = safe(불변식).
  //    사전 조회 실패 → failed(설계 §4.4).
  let intent = parsedIntent;
  try {
    // supabase-js 클라이언트는 AliasDb를 구조적으로 만족(제네릭 차이만 캐스트로 흡수).
    // eslint 타입체커는 단일 캐스트를 불필요하다고 보지만, tsc --noEmit은 단일 캐스트에서
    // TS2589(과도한 타입 인스턴스화)로 실패한다. `as unknown as`로 우회.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const aliases = await getSafeBrandAliases(supabase as unknown as AliasDb);
    const brand = matchBrand(query, aliases);
    if (brand) intent = { ...intent, brand };
  } catch {
    return failed(parsedIntent);
  }

  // 3) mode 판정 — 신호 없으면 DB 조회 없이 failed(일반 상위 상품 노출 금지).
  const mode = deriveSearchMode(parserDegraded, intent);
  if (mode === "failed") return failed(intent);

  // 4) 하드 필터 쿼리(브랜드 eq 포함) → 후보 페치 → 소프트 랭킹.
  const base = supabase
    .from("search_goods")
    .select(SEARCH_SUMMARY_COLUMNS) as unknown as GoodsQuery;
  const queryBuilder = buildGoodsQuery(base, intent);
  const { data, error } = await (queryBuilder as unknown as PromiseLike<{
    data: SearchGoodsRow[] | null;
    error: unknown;
  }>);
  if (error || !data) return failed(intent);

  const candidates = data.map(mapGoodsRow);
  const results = rankGoods(candidates, intent, 300);
  return Response.json({ results, intent, mode } satisfies SearchPayload);
}
