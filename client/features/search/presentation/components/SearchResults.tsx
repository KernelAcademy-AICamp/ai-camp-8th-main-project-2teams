"use client";

// 페이지 2 본체 — URL의 q를 읽어 검색. 간략 리스트로 표시.
import { useRouter, useSearchParams } from "next/navigation";

import AppHeader from "@/components/AppHeader";

import { useSearchViewModel } from "../view-model/use-search-view-model";
import IntentChips from "./IntentChips";
import ResultList from "./ResultList";
import SearchBar from "./SearchBar";

export default function SearchResults() {
  const router = useRouter();
  const params = useSearchParams();
  const query = params.get("q") ?? "";

  const vm = useSearchViewModel(query);
  const go = (q: string) => {
    router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />

      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-6">
        <SearchBar initialValue={query} onSearch={go} />

        {query && (
          <div className="rise mt-5">
            <IntentChips chips={vm.chips} />
          </div>
        )}

        <div className="mb-3 mt-6 flex items-baseline justify-between">
          <h2 className="font-display text-lg font-bold text-ink">검색 결과</h2>
          <span className="font-mono text-[12px] text-ink-soft">
            {vm.results.length}개
          </span>
        </div>

        {vm.results.length > 0 ? (
          <ResultList tees={vm.results} />
        ) : (
          <div className="grid place-items-center rounded-2xl border border-dashed border-line py-16 text-center">
            <p className="font-display text-lg font-bold text-ink">
              딱 맞는 티가 없어요
            </p>
            <p className="mt-1 max-w-xs text-[13px] text-ink-soft">
              조건을 조금 줄이거나 다른 색·핏으로 다시 찾아보세요.
            </p>
          </div>
        )}
      </main>

      <footer className="border-t border-line px-5 py-6">
        <p className="mx-auto max-w-5xl font-mono text-[11px] text-ink-soft">
          목업 데이터 · Loop 1 UI 프로토타입 — 검색은 임시 규칙 파서(LLM 대체 예정)
        </p>
      </footer>
    </div>
  );
}
