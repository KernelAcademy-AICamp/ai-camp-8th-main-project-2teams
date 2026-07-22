// 공용 헤더 — 로고(→ 홈). 검색/상세 화면 상단.
import Link from "next/link";

export default function AppHeader() {
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
      </div>
    </header>
  );
}
