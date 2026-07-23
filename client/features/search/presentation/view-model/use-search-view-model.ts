"use client";

// ViewModel (MVVM) — 검색 결과 화면. query(=URL)를 입력받아 로딩·의도칩·결과를 계산.
// 파싱은 서버 라우트(/api/parse)의 LLM으로 수행하므로 비동기. repository 주입(기본=목업).
import { useCallback, useEffect, useMemo, useState } from "react";

import { getBrands } from "@/features/catalog/data/brand-repository";
import { supabaseTeeRepository } from "@/features/catalog/data/supabase-tee-repository";
import type { TeeRepository } from "@/features/catalog/data/tee-repository";
import type { Tee } from "@/features/catalog/domain/tee";
import { parseQueryRemote } from "@/features/search/data/parse-query-remote";
import type { Intent, IntentChip } from "@/features/search/domain/intent";
import { intentToChips } from "@/features/search/domain/intent-chips";
import { type BrandEntry, matchBrand } from "@/features/search/domain/match-brand";
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
  const [brands, setBrands] = useState<BrandEntry[]>([]);
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

  // 브랜드 사전 로드(검색 시 결정적 브랜드 매칭에 사용).
  useEffect(() => {
    let active = true;
    void getBrands().then((data) => {
      if (active) setBrands(data);
    });
    return () => {
      active = false;
    };
  }, []);

  // 쿼리 변경 시 LLM 파싱(비동기) + 브랜드 사전 매칭. 결과는 .then 콜백에서만 반영(동기 setState 회피).
  useEffect(() => {
    let active = true;
    void parseQueryRemote(query, brands).then((intent) => {
      if (active) setParsed({ query, intent });
    });
    return () => {
      active = false;
    };
  }, [query, brands]);

  const hasQuery = query.trim().length > 0;
  // 빈 쿼리는 파싱 대상이 아니므로 로딩에서 제외(전체 목록을 로딩 UI로 가리지 않기).
  // 현재 query가 아직 파싱 반영 전이면 파싱 중 → 로딩.
  const parsing = hasQuery && parsed.query !== query;

  // 브랜드는 결정적 사전 매칭이라 LLM 파싱을 안 기다려도 된다 → 즉시 계산해 파싱 중에도 노출.
  const immediateBrand = useMemo(
    () => (hasQuery ? matchBrand(query, brands) : undefined),
    [hasQuery, query, brands],
  );

  // 파싱 중엔 브랜드 칩만 즉시, 완료되면 전체(색·핏 등) 칩.
  const chips = useMemo(() => {
    if (!hasQuery) return [];
    if (parsing)
      return immediateBrand ? [{ label: immediateBrand, kind: "brand" as const }] : [];
    return intentToChips(workingIntent);
  }, [hasQuery, parsing, immediateBrand, workingIntent]);

  // 파싱 중엔 브랜드로만 필터(즉시 결과), 완료되면 전체 의도로 필터.
  const results = useMemo<SearchResult>(() => {
    if (!hasQuery) return { exact: tees, partial: [] };
    const intent = parsing ? { functional: [], brand: immediateBrand } : workingIntent;
    return searchTees(tees, intent);
  }, [hasQuery, parsing, immediateBrand, tees, workingIntent]);

  // 브랜드가 즉시 잡히면 결과를 로딩으로 가리지 않는다(파싱은 뒤에서 계속 → 완료 시 정밀화).
  return {
    loading: teesLoading || (parsing && !immediateBrand),
    chips,
    results,
    removeConstraint,
  };
}
