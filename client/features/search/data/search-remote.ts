"use client";

// 데이터 접근: 자연어 쿼리 → /api/search(서버 하이브리드 검색). degraded·오류 시
// 기존 규칙 파싱 + searchTees로 로컬 폴백해 검색이 멈추지 않게 한다.
import type { Tee } from "@/features/catalog/domain/tee";
import { parseQueryRemote } from "@/features/search/data/parse-query-remote";
import type { Intent } from "@/features/search/domain/intent";
import { type BrandEntry, matchBrand } from "@/features/search/domain/match-brand";
import { type SearchResult, searchTees } from "@/features/search/domain/search-tees";

const SEARCH_TIMEOUT_MS = 9000;
const EMPTY_INTENT: Intent = { functional: [] };

interface SearchApiResponse {
  results?: Tee[];
  intent?: Intent;
  degraded?: boolean;
}

async function localFallback(
  query: string,
  brands: BrandEntry[],
  fallbackTees: Tee[],
): Promise<{ results: SearchResult; intent: Intent }> {
  const intent = await parseQueryRemote(query, brands);
  return { results: searchTees(fallbackTees, intent), intent };
}

export async function searchRemote(
  query: string,
  brands: BrandEntry[],
  fallbackTees: Tee[],
): Promise<{ results: SearchResult; intent: Intent }> {
  if (!query.trim())
    return { results: { exact: fallbackTees, partial: [] }, intent: EMPTY_INTENT };

  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, SEARCH_TIMEOUT_MS);
  try {
    const res = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`search route ${String(res.status)}`);
    const data = (await res.json()) as SearchApiResponse;
    if (data.degraded || !Array.isArray(data.results)) {
      return await localFallback(query, brands, fallbackTees);
    }
    const serverIntent = data.intent ?? EMPTY_INTENT;
    const brand = matchBrand(query, brands);
    const intent = brand ? { ...serverIntent, brand } : serverIntent;
    return { results: { exact: data.results, partial: [] }, intent };
  } catch {
    return await localFallback(query, brands, fallbackTees);
  } finally {
    clearTimeout(timer);
  }
}
