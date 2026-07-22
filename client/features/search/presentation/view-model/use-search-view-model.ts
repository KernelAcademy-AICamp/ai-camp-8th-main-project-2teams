"use client";

// ViewModel (MVVM) — 검색 결과 화면. query(=URL)를 입력받아 로딩·의도칩·결과를 계산.
// 파싱은 서버 라우트(/api/parse)의 LLM으로 수행하므로 비동기. repository 주입(기본=목업).
import { useEffect, useMemo, useState } from "react";

import { mockTeeRepository } from "@/features/catalog/data/mock-tee-repository";
import type { TeeRepository } from "@/features/catalog/data/tee-repository";
import type { Tee } from "@/features/catalog/domain/tee";
import { parseQueryRemote } from "@/features/search/data/parse-query-remote";
import type { Intent, IntentChip } from "@/features/search/domain/intent";
import { intentToChips } from "@/features/search/domain/intent-chips";
import { searchTees } from "@/features/search/domain/search-tees";

export interface SearchViewModel {
  loading: boolean;
  chips: IntentChip[];
  results: Tee[];
}

const EMPTY_INTENT: Intent = { functional: [] };

export function useSearchViewModel(
  query: string,
  repository: TeeRepository = mockTeeRepository,
): SearchViewModel {
  const [tees, setTees] = useState<Tee[]>([]);
  const [teesLoading, setTeesLoading] = useState(true);
  // 마지막으로 파싱을 끝낸 (쿼리, 의도) 쌍. parsed.query가 현재 query와 다르면 아직 파싱 중.
  const [parsed, setParsed] = useState<{ query: string; intent: Intent }>({
    query: "",
    intent: EMPTY_INTENT,
  });

  // 카탈로그 로드
  useEffect(() => {
    let active = true;
    void repository.getAll().then((data) => {
      if (!active) return;
      setTees(data);
      setTeesLoading(false);
    });
    return () => {
      active = false;
    };
  }, [repository]);

  // 쿼리 변경 시 LLM 파싱(비동기). 결과는 .then 콜백에서만 반영(동기 setState 회피).
  useEffect(() => {
    let active = true;
    void parseQueryRemote(query).then((intent) => {
      if (active) setParsed({ query, intent });
    });
    return () => {
      active = false;
    };
  }, [query]);

  // 현재 query가 아직 파싱 반영 전이면 파싱 중 → 로딩.
  const parsing = parsed.query !== query;

  const chips = useMemo(
    () => (query.trim() ? intentToChips(parsed.intent) : []),
    [query, parsed.intent],
  );

  const results = useMemo(
    () => (query.trim() ? searchTees(tees, parsed.intent) : tees),
    [query, tees, parsed.intent],
  );

  return { loading: teesLoading || parsing, chips, results };
}
