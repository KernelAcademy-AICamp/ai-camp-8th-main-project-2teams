// Route Handler — 무신사 구조화 검색. 서버에서 LLM 파싱 → search_goods 하드필터 → 앱단 소프트 랭킹.
// ⚠️ 서버 전용. NVIDIA/Supabase 키는 여기서만.
import { createClient } from "@supabase/supabase-js";

import type { Goods } from "@/features/catalog/domain/goods";
import {
  buildGoodsQuery,
  type GoodsQuery,
} from "@/features/search/data/build-goods-query";
import { mapGoodsRow, type SearchGoodsRow } from "@/features/search/data/map-goods-row";
import { parseQueryIntent } from "@/features/search/data/parse-query-intent";
import { EMPTY_INTENT, type QueryIntent } from "@/features/search/domain/query-intent";
import { rankGoods } from "@/features/search/domain/rank-goods";

export const maxDuration = 30;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
// publishable(=anon) 키. search_goods는 anon SELECT 허용.
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

function readQuery(body: unknown): string {
  if (typeof body !== "object" || body === null) return "";
  const q = (body as Record<string, unknown>).query;
  return typeof q === "string" ? q.trim() : "";
}

interface SearchPayload {
  results: Goods[];
  intent: QueryIntent;
  degraded: boolean;
}

export async function POST(request: Request): Promise<Response> {
  const body: unknown = await request.json().catch(() => null);
  const query = readQuery(body);
  if (!query) {
    const empty: SearchPayload = { results: [], intent: EMPTY_INTENT, degraded: false };
    return Response.json(empty);
  }

  // 1) LLM 파싱 → 구조화 QueryIntent.
  const { intent, degraded } = await parseQueryIntent(query);
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return Response.json({
      results: [],
      intent,
      degraded: true,
    } satisfies SearchPayload);
  }

  // 2) 하드 필터 쿼리 → 후보 전량 페치.
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const base = supabase.from("search_goods").select("*") as unknown as GoodsQuery;
  const queryBuilder = buildGoodsQuery(base, intent);
  const { data, error } = await (queryBuilder as unknown as PromiseLike<{
    data: SearchGoodsRow[] | null;
    error: unknown;
  }>);
  if (error || !data) {
    return Response.json({
      results: [],
      intent,
      degraded: true,
    } satisfies SearchPayload);
  }

  // 3) 매핑 + 앱단 소프트 랭킹 → top 60.
  const candidates = data.map(mapGoodsRow);
  const results = rankGoods(candidates, intent, 60);
  return Response.json({ results, intent, degraded } satisfies SearchPayload);
}
