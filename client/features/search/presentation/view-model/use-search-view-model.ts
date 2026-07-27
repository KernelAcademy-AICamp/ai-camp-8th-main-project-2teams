"use client";

// ViewModel (MVVM) — 검색 결과 화면. query(=URL)를 입력받아 로딩·의도칩·결과를 계산.
// 파싱은 서버 라우트(/api/parse)의 LLM으로 수행하므로 비동기. repository 주입(기본=목업).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getBrands } from "@/features/catalog/data/brand-repository";
import { supabaseTeeRepository } from "@/features/catalog/data/supabase-tee-repository";
import type { TeeRepository } from "@/features/catalog/data/tee-repository";
import type { Tee } from "@/features/catalog/domain/tee";
import { searchRemote } from "@/features/search/data/search-remote";
import type { Intent, IntentChip } from "@/features/search/domain/intent";
import { intentToChips } from "@/features/search/domain/intent-chips";
import { type BrandEntry, matchBrand } from "@/features/search/domain/match-brand";
import { reconcileWorkingIntent } from "@/features/search/domain/reconcile-working-intent";
import { removeConstraintFromIntent } from "@/features/search/domain/remove-constraint";
import { type SearchResult, searchTees } from "@/features/search/domain/search-tees";
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
  results: SearchResult;
  removeConstraint: (chip: IntentChip) => void;
  searchId: string;
  resultType: ResultType;
}

const EMPTY_INTENT: Intent = { functional: [] };
const EMPTY_RESULT: SearchResult = { exact: [], partial: [] };

export function useSearchViewModel(
  query: string,
  src: string | null,
  repository: TeeRepository = supabaseTeeRepository,
): SearchViewModel {
  // ref는 콜백(검색 effect·removeConstraint)에서만 읽는다. 렌더 중 읽기는
  // react-hooks/refs(React Compiler) 위반이므로, 반환용으로는 별도 state로 노출한다.
  const searchIdRef = useRef("");
  const [searchId, setSearchId] = useState("");
  const [tees, setTees] = useState<Tee[]>([]);
  const [teesLoading, setTeesLoading] = useState(true);
  const [brands, setBrands] = useState<BrandEntry[]>([]);
  // 검색 호출에 최신 brands/tees를 쓰되(폴백 입력) 그 변경으로 재검색을 유발하지 않도록 ref로 보관.
  // 렌더 중 ref 쓰기는 react-hooks/refs가 막으므로 커밋 후 effect에서 동기화한다.
  const teesRef = useRef(tees);
  const brandsRef = useRef(brands);
  useEffect(() => {
    teesRef.current = tees;
    brandsRef.current = brands;
  }, [tees, brands]);
  // 마지막으로 검색을 끝낸 (쿼리, 의도, 결과) 묶음. parsed.query가 현재 query와 다르면 아직 검색 중.
  const [parsed, setParsed] = useState<{
    query: string;
    intent: Intent;
    results: SearchResult;
  }>({ query: "", intent: EMPTY_INTENT, results: EMPTY_RESULT });

  const [prevParsed, setPrevParsed] = useState(parsed);
  const [workingIntent, setWorkingIntent] = useState<Intent>(EMPTY_INTENT);

  // 파싱 결과가 갱신되면 편집 상태를 초기화(삭제분 리셋).
  // useEffect가 아닌 렌더 중 조정 패턴(React 공식 권장)을 사용 —
  // effect 안에서 setState하면 react-hooks/set-state-in-effect(캐스케이드 렌더) 린트 오류가 난다.
  if (parsed !== prevParsed) {
    setPrevParsed(parsed);
    setWorkingIntent(parsed.intent);
  }
  // setWorkingIntent는 다음 렌더에 반영되므로, 이번 렌더의 chips/results는
  // reconcileWorkingIntent가 고른 값(갓 갱신된 parsed.intent)을 써야 desync가 없다.
  // workingIntent state를 직접 읽으면 한 프레임 낡아 전체 상품이 잠깐 튄다.
  const currentIntent = reconcileWorkingIntent(parsed, prevParsed, workingIntent);

  const removeConstraint = useCallback(
    (chip: IntentChip) => {
      const next = removeConstraintFromIntent(workingIntent, chip);
      const candidates = [...parsed.results.exact, ...parsed.results.partial];
      const after = searchTees(candidates, next);
      track("constraint_removed", {
        search_id: searchIdRef.current,
        attribute: chip.kind,
        after_result_count: after.exact.length + after.partial.length,
        after_result_type: deriveResultType(after),
      });
      setWorkingIntent(next);
    },
    [workingIntent, parsed],
  );

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

  // 쿼리 변경 시에만 서버 하이브리드 검색. brands/tees는 ref로 읽어 재검색을 유발하지 않는다
  // (초기 로드 시 중복 호출 방지 → NVIDIA 비용 절감). 결과+intent를 함께 반영하고,
  // 검색 1건 완료 시 search_performed를 정확히 한 번 발화한다.
  useEffect(() => {
    let active = true;
    if (!query.trim()) return;
    const id = newSearchId();
    searchIdRef.current = id;
    const startedAt = performance.now();
    void searchRemote(query, brandsRef.current, teesRef.current).then(
      ({ results, intent, degraded }) => {
        if (!active) return;
        setParsed({ query, intent, results });
        // searchId state는 표시 중인 results/resultType과 함께 갱신(검색 시작이 아닌 완료 시점).
        setSearchId(id);
        const resultType = deriveResultType(results);
        track("search_performed", {
          search_id: id,
          query,
          result_count: results.exact.length + results.partial.length,
          result_type: resultType,
          degraded,
          understood: hasParsedConstraint(intent),
          entry_type: entryTypeFromSrc(src),
          is_refinement: src === "refine",
          duration_ms: Math.round(performance.now() - startedAt),
          ...flattenParsedAttributes(intent),
        });
      },
    );
    return () => {
      active = false;
    };
  }, [query, src]);

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
    return intentToChips(currentIntent);
  }, [hasQuery, parsing, immediateBrand, currentIntent]);

  // 서버(또는 폴백)가 돌려준 후보 집합. 칩을 편집하면 그 위에서 searchTees로 재필터.
  const results = useMemo<SearchResult>(() => {
    if (!hasQuery) return { exact: tees, partial: [] };
    if (parsing) {
      return immediateBrand
        ? searchTees(tees, { functional: [], brand: immediateBrand })
        : EMPTY_RESULT;
    }
    const candidates = [...parsed.results.exact, ...parsed.results.partial];
    // currentIntent가 파싱 원본과 같으면 서버 순위 그대로, 편집됐으면 재필터.
    // (새 파싱 도착 프레임엔 currentIntent === parsed.intent라 서버 결과를 그대로 써 튐이 없다.)
    return currentIntent === parsed.intent
      ? parsed.results
      : searchTees(candidates, currentIntent);
  }, [hasQuery, parsing, immediateBrand, tees, parsed, currentIntent]);

  const resultType = useMemo(() => deriveResultType(results), [results]);

  // 브랜드가 즉시 잡히면 결과를 로딩으로 가리지 않는다(파싱은 뒤에서 계속 → 완료 시 정밀화).
  return {
    loading: teesLoading || (parsing && !immediateBrand),
    chips,
    results,
    removeConstraint,
    searchId,
    resultType,
  };
}
