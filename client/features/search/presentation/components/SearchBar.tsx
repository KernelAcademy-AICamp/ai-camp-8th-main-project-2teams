// View: 자연어 검색 입력. 로컬 입력 상태만 갖고 onSearch로 위임.
"use client";

import { useState } from "react";

export default function SearchBar({
  initialValue = "",
  onSearch,
  autoFocus = false,
  placeholder = "예: 등판에 노란 레터링 있는 시원한 오버핏 흰티",
}: {
  initialValue?: string;
  onSearch: (q: string) => void;
  autoFocus?: boolean;
  placeholder?: string;
}) {
  const [value, setValue] = useState(initialValue);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) onSearch(value.trim());
      }}
      className="flex items-center gap-2 rounded-2xl border-2 border-ink bg-wall p-2 shadow-[0_10px_40px_-20px_rgba(23,24,28,0.5)] focus-within:border-hold-yellow"
    >
      <input
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
        }}
        placeholder={placeholder}
        aria-label="검색어"
        autoFocus={autoFocus}
        className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-[15px] text-ink outline-none placeholder:text-ink-soft/60"
      />
      <button
        type="submit"
        className="shrink-0 rounded-xl bg-ink px-5 py-2.5 font-display text-sm font-bold text-chalk transition hover:opacity-90"
      >
        찾기
      </button>
    </form>
  );
}
