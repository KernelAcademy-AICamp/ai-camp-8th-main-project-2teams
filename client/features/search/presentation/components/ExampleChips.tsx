// View: 예시 쿼리 칩.
"use client";

import { EXAMPLE_QUERIES } from "../example-queries";

export default function ExampleChips({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {EXAMPLE_QUERIES.map((ex) => (
        <button
          key={ex}
          onClick={() => {
            onPick(ex);
          }}
          className="rounded-full border border-line bg-chalk px-3 py-1.5 text-[12px] text-ink-soft transition hover:border-ink hover:text-ink"
        >
          {ex}
        </button>
      ))}
    </div>
  );
}
