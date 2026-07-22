"use client";

// 페이지 1 — 구글형 검색 랜딩. 검색창 하나에 집중. 검색 시 /search 로 이동.
import { useRouter } from "next/navigation";

import ExampleChips from "@/features/search/presentation/components/ExampleChips";
import SearchBar from "@/features/search/presentation/components/SearchBar";

export default function LandingPage() {
  const router = useRouter();
  const go = (q: string) => {
    router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <div className="chalk-grain flex flex-1 flex-col items-center justify-center px-5 pb-24">
      <main className="w-full max-w-xl text-center">
        <p className="mb-4 font-mono text-[12px] uppercase tracking-[0.2em] text-ink-soft">
          클라이밍 프린팅 티 · 발견 검색
        </p>
        <h1 className="font-display text-5xl font-extrabold tracking-tight text-ink sm:text-6xl">
          search<span className="text-hold-yellow">·</span>by
          <span className="text-hold-yellow">·</span>llm
        </h1>
        <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-ink-soft">
          머릿속 그 티를 말로 찾으세요. 색·프린팅 위치·핏·기능성을 한 문장으로.
        </p>

        <div className="mt-8">
          <SearchBar onSearch={go} autoFocus />
        </div>

        <div className="mt-5">
          <ExampleChips onPick={go} />
        </div>
      </main>
    </div>
  );
}
