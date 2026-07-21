"use client";

// 공용 헤더 — 로고(→ 홈) + 찜 카운트. 검색/상세 화면 상단.
import Link from "next/link";

import { useSaved } from "@/features/saved/use-saved";

export default function AppHeader() {
  const { count } = useSaved();
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-chalk/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3.5">
        <Link
          href="/"
          className="font-display text-lg font-extrabold tracking-tight text-ink"
        >
          search<span className="text-hold-yellow">·</span>by
          <span className="text-hold-yellow">·</span>llm
        </Link>
        <span className="flex items-center gap-1.5 font-mono text-[12px] text-ink-soft">
          <span className="text-hold-coral">♥</span>찜 {count}
        </span>
      </div>
    </header>
  );
}
