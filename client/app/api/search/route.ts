// Route Handler — 하이브리드 검색. 서버에서 LLM 파싱 → 쿼리 임베딩 → search_products RPC.
// ⚠️ 서버 전용. NVIDIA/Supabase 키는 여기서만.
import { createClient } from "@supabase/supabase-js";

import type { Tee } from "@/features/catalog/domain/tee";
import { embedQuery } from "@/features/search/data/embed-query";
import { EMPTY_INTENT, parseIntentLLM } from "@/features/search/data/parse-intent-llm";
import { mapSearchRow, type SearchRow } from "@/features/search/data/search-response";
import { extractReviewTags } from "@/features/search/domain/extract-review-tags";
import type { Intent } from "@/features/search/domain/intent";

export const maxDuration = 30;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
// 이 repo는 anon이 아니라 publishable 키 이름을 쓴다(supabase-client.ts와 동일). 읽기 RLS는 public.
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

function readQuery(body: unknown): string {
  if (typeof body !== "object" || body === null) return "";
  const q = (body as Record<string, unknown>).query;
  return typeof q === "string" ? q.trim() : "";
}

interface SearchPayload {
  results: Tee[];
  intent: Intent;
  semanticQuery: string;
  degraded: boolean;
}

export async function POST(request: Request): Promise<Response> {
  const body: unknown = await request.json().catch(() => null);
  const query = readQuery(body);
  const empty: SearchPayload = {
    results: [],
    intent: EMPTY_INTENT,
    semanticQuery: "",
    degraded: false,
  };
  if (!query) return Response.json(empty);

  // 1) LLM 파싱(intent + 확장 쿼리 + keywords). 실패해도 EMPTY intent + 원쿼리로 진행.
  const { intent: llmIntent, semanticQuery, keywords } = await parseIntentLLM(query);
  // 1-b) 리뷰태그는 결정적 키워드 사전이 권위(8B LLM의 태그 비결정성·오염 제거).
  //      LLM은 색·핏·성별·그래픽·semanticQuery 담당. functional만 합집합.
  //      단, 사전이 아무 태그도 못 잡은 신규 표현은 LLM 태그를 폴백으로 써 리콜을 확보한다.
  const det = extractReviewTags(query);
  // 사전이 어떤 태그든 잡았으면 사전을 전적으로 신뢰(LLM 태그 오염 배제).
  // 사전이 완전히 비었을 때만 LLM 태그를 폴백으로 써 신규 표현 리콜을 확보한다.
  const dictHasAny =
    det.reviewTags.length > 0 ||
    det.excludeTags.length > 0 ||
    det.functional.length > 0;
  const intent: Intent = {
    ...llmIntent,
    functional: dictHasAny
      ? det.functional
      : [...new Set([...llmIntent.functional, ...det.functional])],
    reviewTags: dictHasAny ? det.reviewTags : (llmIntent.reviewTags ?? []),
    excludeTags: dictHasAny ? det.excludeTags : (llmIntent.excludeTags ?? []),
  };

  // 2) 확장 쿼리 임베딩. 실패하면 의미검색 불가 → degraded 신호로 클라 폴백 유도.
  const vector = await embedQuery(semanticQuery);
  if (!vector || !SUPABASE_URL || !SUPABASE_KEY) {
    return Response.json({ results: [], intent, semanticQuery, degraded: true });
  }

  // 3) RPC 호출.
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const rpcResponse = await supabase.rpc("search_products", {
    query_embedding: vector,
    intent,
    keywords,
    match_limit: 60,
  });
  // data만 구조분해하면 (createClient에 Database 제네릭이 없어) any로 추론돼
  // no-unsafe-assignment에 걸린다 — error만 분해하고 data는 아래서 캐스트해 사용한다.
  const { error } = rpcResponse;
  if (error) {
    return Response.json({ results: [], intent, semanticQuery, degraded: true });
  }
  const results = (rpcResponse.data as SearchRow[]).map(mapSearchRow);
  return Response.json({ results, intent, semanticQuery, degraded: false });
}
