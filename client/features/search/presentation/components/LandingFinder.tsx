"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { SearchIcon, SpinnerIcon } from "./icons";

const QUICK_QUERIES = [
  "등판에 오렌지 프린트가 있는 흰 티",
  "블루 그래픽 오버핏 반팔티",
  "검정 바탕 시안 프린팅 티",
] as const;

export default function LandingFinder() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);
  const [placeholder, setPlaceholder] = useState<string>(QUICK_QUERIES[0]);
  const areaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 플레이스홀더에 예시 질의가 타이핑되는 데모 (모션 최소화 설정이면 생략)
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let queryIndex = 0;
    let charIndex = 0;
    let erasing = false;

    const id = window.setInterval(() => {
      // 탭이 백그라운드거나 입력에 포커스가 있으면 리렌더를 건너뛴다.
      if (document.hidden || document.activeElement === inputRef.current) return;
      const sample = QUICK_QUERIES[queryIndex % QUICK_QUERIES.length] ?? "";
      if (!erasing) {
        charIndex += 1;
        if (charIndex >= sample.length + 16) erasing = true; // 다 친 뒤 잠깐 머무름
      } else {
        charIndex -= 1;
        if (charIndex <= 0) {
          erasing = false;
          queryIndex = (queryIndex + 1) % QUICK_QUERIES.length;
        }
      }
      setPlaceholder(sample.slice(0, Math.min(charIndex, sample.length)));
    }, 65);

    return () => {
      window.clearInterval(id);
    };
  }, []);

  const search = (value: string, source: "typed" | "chip") => {
    const trimmed = value.trim();
    if (!trimmed || isPending) return;

    startTransition(() => {
      router.push(`/search?q=${encodeURIComponent(trimmed)}&src=${source}`);
    });
  };

  return (
    <div
      ref={areaRef}
      id="finder"
      className={`tf-finder${isOpen ? " is-open" : ""}`}
      onFocus={() => {
        setIsOpen(true);
      }}
      onBlur={(event) => {
        if (!areaRef.current?.contains(event.relatedTarget)) {
          setIsOpen(false);
        }
      }}
    >
      <form
        className="tf-search"
        role="search"
        aria-busy={isPending}
        onSubmit={(event) => {
          event.preventDefault();
          search(query, "typed");
        }}
      >
        <div className="tf-search__pill">
          <input
            ref={inputRef}
            className="tf-search__input"
            type="search"
            aria-label="티셔츠 검색"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            placeholder={placeholder}
            autoComplete="off"
          />
          <button
            className="tf-search__btn"
            type="submit"
            aria-label="검색"
            disabled={!query.trim() || isPending}
            tabIndex={isOpen ? 0 : -1}
          >
            {isPending ? (
              <SpinnerIcon className="tf-search__spinner" />
            ) : (
              <SearchIcon />
            )}
          </button>
        </div>

        <span className="sr-only" aria-live="polite">
          {isPending ? "검색 결과를 불러오는 중입니다." : ""}
        </span>
      </form>

      <div className="tf-chips" aria-label="추천 검색어" aria-hidden={!isOpen}>
        {QUICK_QUERIES.map((item) => (
          <button
            key={item}
            type="button"
            className="tf-chip"
            disabled={isPending}
            tabIndex={isOpen ? 0 : -1}
            onClick={() => {
              search(item, "chip");
            }}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}
