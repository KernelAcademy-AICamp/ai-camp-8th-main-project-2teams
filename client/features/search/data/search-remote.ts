"use client";

// 데이터 접근: 자연어 쿼리 → /api/search(서버 무신사 구조화 검색).
// 폴백 없음 — degraded/오류 시 빈 결과 + degraded=true(화면에서 재시도 안내).
import type { Goods } from "@/features/catalog/domain/goods";
import { EMPTY_INTENT, type QueryIntent } from "@/features/search/domain/query-intent";

const SEARCH_TIMEOUT_MS = 9000;

export interface SearchOutcome {
  results: Goods[];
  intent: QueryIntent;
  degraded: boolean;
}

interface SearchApiResponse {
  results?: Goods[];
  intent?: QueryIntent;
  degraded?: boolean;
}

export async function searchRemote(
  query: string,
  fetchFn: typeof fetch = fetch,
): Promise<SearchOutcome> {
  if (!query.trim()) return { results: [], intent: EMPTY_INTENT, degraded: false };

  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, SEARCH_TIMEOUT_MS);
  try {
    const httpRes = await fetchFn("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
      signal: controller.signal,
    });
    if (!httpRes.ok) throw new Error(`search route ${String(httpRes.status)}`);
    const data = (await httpRes.json()) as SearchApiResponse;
    if (data.degraded || !Array.isArray(data.results)) {
      return { results: [], intent: data.intent ?? EMPTY_INTENT, degraded: true };
    }
    return {
      results: data.results,
      intent: data.intent ?? EMPTY_INTENT,
      degraded: false,
    };
  } catch {
    return { results: [], intent: EMPTY_INTENT, degraded: true };
  } finally {
    clearTimeout(timer);
  }
}
