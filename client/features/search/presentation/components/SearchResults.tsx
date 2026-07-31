"use client";

// 페이지 2 본체 — URL의 q를 읽어 무신사 검색. 이미지 카드 그리드로 표시.
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
  const vm = useSearchViewModel(query, params.get("src"));
  const go = (q: string, src = "refine") => {
    router.push(`/search?q=${encodeURIComponent(q)}&src=${src}`);
  };

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-6">
        <SearchBar key={query} initialValue={query} onSearch={go} />

        {query.trim() &&
          !vm.loading &&
          vm.mode !== "failed" &&
          (vm.chips.length > 0 || vm.results.length === 0) && (
            <div className="rise mt-5">
              <IntentChips chips={vm.chips} />
            </div>
          )}

        {(() => {
          if (vm.loading) {
            return (
              <div className="mt-6 grid place-items-center rounded-2xl border border-dashed border-line py-16 text-center">
                <p className="font-display text-lg font-bold text-ink">검색 중…</p>
                <p className="mt-1 text-[13px] text-ink-soft">
                  조건을 분석하고 있어요.
                </p>
              </div>
            );
          }
          if (!query.trim()) {
            return (
              <div className="mt-6 grid place-items-center rounded-2xl border border-dashed border-line py-16 text-center">
                <p className="font-display text-lg font-bold text-ink">
                  말로 찾아보세요
                </p>
                <p className="mt-1 max-w-xs text-[13px] text-ink-soft">
                  색·핏·소재·사이즈·가격을 한 문장으로.
                </p>
              </div>
            );
          }
          if (vm.mode === "failed") {
            return (
              <div className="mt-6 grid place-items-center rounded-2xl border border-dashed border-line py-16 text-center">
                <p className="font-display text-lg font-bold text-ink">
                  검색을 완료하지 못했어요
                </p>
                <p className="mt-1 max-w-xs text-[13px] text-ink-soft">
                  잠시 후 다시 시도해 주세요.
                </p>
                <button
                  type="button"
                  onClick={vm.retry}
                  className="mt-4 rounded-xl bg-ink px-5 py-2.5 font-display text-sm font-bold text-chalk transition hover:opacity-90"
                >
                  다시 시도
                </button>
              </div>
            );
          }
          if (vm.results.length === 0) {
            return (
              <div className="mt-6 grid place-items-center rounded-2xl border border-dashed border-line py-16 text-center">
                <p className="font-display text-lg font-bold text-ink">결과가 없어요</p>
                <p className="mt-1 max-w-xs text-[13px] text-ink-soft">
                  조건을 조금 줄이거나 다시 검색해 보세요.
                </p>
              </div>
            );
          }
          return (
            <>
              {vm.mode === "lexical_only" && (
                <p className="mb-2 mt-4 rounded-xl border border-line bg-wall px-4 py-2.5 text-[13px] text-ink-soft">
                  조건 분석이 불안정해 브랜드 일치 결과만 보여드려요.
                </p>
              )}
              <div className="mb-3 mt-6 flex items-baseline justify-between">
                <h2 className="font-display text-lg font-bold text-ink">검색 결과</h2>
                <span className="font-mono text-[12px] text-ink-soft">
                  {vm.results.length}개
                </span>
              </div>
              <ResultList
                goods={vm.results}
                searchId={vm.searchId}
                resultType={vm.resultType}
              />
            </>
          );
        })()}
      </main>
      <footer className="border-t border-line px-5 py-6">
        <p className="mx-auto max-w-5xl font-mono text-[11px] text-ink-soft">
          무신사 상품 · 자연어 발견 검색
        </p>
      </footer>
    </div>
  );
}
