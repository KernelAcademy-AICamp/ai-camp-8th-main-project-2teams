"use client";

// View: 찜 토글 버튼. saved 스토어에 연결.
import { useSaved } from "./use-saved";

export default function SaveButton({
  id,
  className = "",
}: {
  id: string;
  className?: string;
}) {
  const { isSaved, toggle } = useSaved();
  const saved = isSaved(id);
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(id);
      }}
      aria-label={saved ? "찜 해제" : "찜하기"}
      aria-pressed={saved}
      className={`grid place-items-center rounded-full transition hover:scale-110 ${className}`}
    >
      <span className={saved ? "text-hold-coral" : "text-ink-soft"}>
        {saved ? "♥" : "♡"}
      </span>
    </button>
  );
}
