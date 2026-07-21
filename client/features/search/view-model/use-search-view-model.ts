"use client";

// ViewModel (MVVM) — 검색 결과 화면. query(=URL)를 입력받아 로딩·의도칩·결과를 계산.
// repository 주입(기본=목업)으로 데이터소스를 UI 손 안 대고 교체 가능.
import { useEffect, useMemo, useState } from "react";

import { mockTeeRepository } from "@/lib/data/mock-tee-repository";
import type { TeeRepository } from "@/lib/data/tee-repository";
import type { IntentChip } from "@/lib/domain/intent";
import type { Tee } from "@/lib/domain/tee";
import { parseQuery } from "@/lib/usecases/parse-query";
import { searchTees } from "@/lib/usecases/search-tees";

export interface SearchViewModel {
  loading: boolean;
  chips: IntentChip[];
  results: Tee[];
}

export function useSearchViewModel(
  query: string,
  repository: TeeRepository = mockTeeRepository,
): SearchViewModel {
  const [tees, setTees] = useState<Tee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void repository.getAll().then((data) => {
      if (!active) return;
      setTees(data);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [repository]);

  const { chips, results } = useMemo(() => {
    if (!query.trim()) return { chips: [] as IntentChip[], results: tees };
    const { intent, chips } = parseQuery(query);
    return { chips, results: searchTees(tees, intent) };
  }, [query, tees]);

  return { loading, chips, results };
}
