"use client";

// 데이터 접근: 자연어 쿼리 → /api/search. mode 계약(설계 §4.4) 소비.
// lexical_only는 결과 보존. 오류/타임아웃/비정상 응답 → failed 빈 결과.
import type { Goods } from "@/features/catalog/domain/goods";
import { EMPTY_INTENT, type QueryIntent } from "@/features/search/domain/query-intent";
import type { SearchMode } from "@/features/search/domain/search-mode";

const SEARCH_TIMEOUT_MS = 9000;
const MODES: readonly SearchMode[] = ["full", "lexical_only", "failed"];

export interface SearchOutcome {
  results: Goods[];
  intent: QueryIntent;
  mode: SearchMode;
  titleTier: string | null;
  titleSalvage: boolean;
  titleDropped: boolean;
}

interface SearchApiResponse {
  results?: Goods[];
  intent?: QueryIntent;
  mode?: string;
  titleTier?: string | null;
  titleSalvage?: boolean;
  titleDropped?: boolean;
}

const FAILED: SearchOutcome = {
  results: [],
  intent: EMPTY_INTENT,
  mode: "failed",
  titleTier: null,
  titleSalvage: false,
  titleDropped: false,
};

export async function searchRemote(
  query: string,
  fetchFn: typeof fetch = fetch,
): Promise<SearchOutcome> {
  if (!query.trim()) return FAILED;

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
    const mode = MODES.find((m) => m === data.mode);
    if (!mode || !Array.isArray(data.results)) return FAILED;
    if (mode === "failed") {
      return {
        results: [],
        intent: data.intent ?? EMPTY_INTENT,
        mode,
        titleTier: data.titleTier ?? null,
        titleSalvage: false,
        titleDropped: false,
      };
    }
    return {
      results: data.results,
      intent: data.intent ?? EMPTY_INTENT,
      mode,
      titleTier: data.titleTier ?? null,
      titleSalvage: data.titleSalvage ?? false,
      titleDropped: data.titleDropped ?? false,
    };
  } catch {
    return FAILED;
  } finally {
    clearTimeout(timer);
  }
}
