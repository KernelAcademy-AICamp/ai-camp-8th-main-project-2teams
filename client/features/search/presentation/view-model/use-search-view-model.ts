"use client";

// ViewModel (MVVM) — 검색 결과 화면. query(=URL)로 로딩·의도칩·결과·degraded 계산.
// 서버 /api/search(무신사) 호출. 칩은 읽기 전용(2a). 상태 변경은 .then()/이벤트 콜백에서만.
import { useCallback, useEffect, useMemo, useState } from "react";

import type { Goods } from "@/features/catalog/domain/goods";
import { searchRemote } from "@/features/search/data/search-remote";
import { EMPTY_INTENT, type QueryIntent } from "@/features/search/domain/query-intent";
import {
  type IntentChip,
  queryIntentToChips,
} from "@/features/search/domain/query-intent-chips";
import { newSearchId, track } from "@/shared/analytics";
import {
  deriveResultType,
  entryTypeFromSrc,
  flattenParsedAttributes,
  hasParsedConstraint,
  type ResultType,
} from "@/shared/analytics-params";

export interface SearchViewModel {
  loading: boolean;
  chips: IntentChip[];
  results: Goods[];
  degraded: boolean;
  searchId: string;
  resultType: ResultType;
  retry: () => void;
}

interface Parsed {
  query: string;
  intent: QueryIntent;
  results: Goods[];
  degraded: boolean;
}
const EMPTY_PARSED: Parsed = {
  query: "",
  intent: EMPTY_INTENT,
  results: [],
  degraded: false,
};

export function useSearchViewModel(query: string, src: string | null): SearchViewModel {
  const [searchId, setSearchId] = useState("");
  const [parsed, setParsed] = useState<Parsed>(EMPTY_PARSED);
  const [attempt, setAttempt] = useState(0);

  // 재시도: 이벤트 콜백(effect 아님)에서 상태 변경. parsed 리셋으로 로딩 파생 + attempt로 effect 재실행.
  const retry = useCallback(() => {
    setParsed(EMPTY_PARSED);
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    let active = true;
    if (!query.trim()) return; // 동기 setState 금지 — 빈 상태는 파생값으로 처리.
    const id = newSearchId();
    const startedAt = performance.now();
    void searchRemote(query).then(({ results, intent, degraded }) => {
      if (!active) return;
      setParsed({ query, intent, results, degraded }); // 비동기 .then — set-state-in-effect 아님.
      setSearchId(id);
      track("search_performed", {
        search_id: id,
        query,
        result_count: results.length,
        result_type: deriveResultType(results),
        degraded,
        understood: hasParsedConstraint(intent),
        entry_type: entryTypeFromSrc(src),
        is_refinement: src === "refine",
        duration_ms: Math.round(performance.now() - startedAt),
        ...flattenParsedAttributes(intent),
      });
    });
    return () => {
      active = false;
    };
  }, [query, src, attempt]);

  const hasQuery = query.trim().length > 0;
  const settled = hasQuery && parsed.query === query; // 검색 완료(현재 쿼리 반영)
  const loading = hasQuery && !settled;

  const chips = useMemo<IntentChip[]>(
    () => (settled ? queryIntentToChips(parsed.intent) : []),
    [settled, parsed.intent],
  );
  const results = useMemo<Goods[]>(
    () => (settled ? parsed.results : []),
    [settled, parsed.results],
  );
  const resultType = useMemo(() => deriveResultType(results), [results]);
  const degraded = settled && parsed.degraded;

  return { loading, chips, results, degraded, searchId, resultType, retry };
}
