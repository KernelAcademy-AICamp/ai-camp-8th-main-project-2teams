"use client";

// ViewModel (MVVM) — 검색 결과 화면. query(=URL)를 입력받아 로딩·의도칩·결과를 계산.
// 파싱은 서버 라우트(/api/parse)의 LLM으로 수행하므로 비동기. repository 주입(기본=목업).
import { useCallback, useEffect, useMemo, useState } from "react";

import { supabaseTeeRepository } from "@/features/catalog/data/supabase-tee-repository";
import type { TeeRepository } from "@/features/catalog/data/tee-repository";
import type { Tee } from "@/features/catalog/domain/tee";
import { parseQueryRemote } from "@/features/search/data/parse-query-remote";
import type { Intent, IntentChip } from "@/features/search/domain/intent";
import { intentToChips } from "@/features/search/domain/intent-chips";
import { removeConstraintFromIntent } from "@/features/search/domain/remove-constraint";
import { type SearchResult, searchTees } from "@/features/search/domain/search-tees";

export interface SearchViewModel {
  loading: boolean;
  chips: IntentChip[];
  results: SearchResult;
  removeConstraint: (chip: IntentChip) => void;
}

const EMPTY_INTENT: Intent = { functional: [] };

export function useSearchViewModel(
  query: string,
  repository: TeeRepository = supabaseTeeRepository,
): SearchViewModel {
  const [tees, setTees] = useState<Tee[]>([]);
  const [teesLoading, setTeesLoading] = useState(true);
  // 마지막으로 파싱을 끝낸 (쿼리, 의도) 쌍. parsed.query가 현재 query와 다르면 아직 파싱 중.
  const [parsed, setParsed] = useState<{ query: string; intent: Intent }>({
    query: "",
    intent: EMPTY_INTENT,
  });

  const [prevParsed, setPrevParsed] = useState(parsed);
  const [workingIntent, setWorkingIntent] = useState<Intent>(EMPTY_INTENT);

  // 파싱 결과가 갱신되면 편집 상태를 초기화(삭제분 리셋).
  // useEffect가 아닌 렌더 중 조정 패턴(React 공식 권장)을 사용 —
  // effect 안에서 setState하면 react-hooks/set-state-in-effect(캐스케이드 렌더) 린트 오류가 난다.
  if (parsed !== prevParsed) {
    setPrevParsed(parsed);
    setWorkingIntent(parsed.intent);
  }

  const removeConstraint = useCallback((chip: IntentChip) => {
    setWorkingIntent((prev) => removeConstraintFromIntent(prev, chip));
  }, []);

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
    () => (query.trim() ? intentToChips(workingIntent) : []),
    [query, workingIntent],
  );

  const results = useMemo<SearchResult>(
    () =>
      query.trim() ? searchTees(tees, workingIntent) : { exact: tees, partial: [] },
    [query, tees, workingIntent],
  );

  return { loading: teesLoading || parsing, chips, results, removeConstraint };
}
