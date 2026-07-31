// View: LLM이 "이해한 조건"을 텍스트 칩으로 표시(읽기 전용).
import type { IntentChip } from "@/features/search/domain/query-intent-chips";

export default function IntentChips({ chips }: { chips: IntentChip[] }) {
  if (chips.length === 0) {
    return (
      <p className="font-mono text-[12px] text-ink-soft">
        조건을 못 알아들었어요. 색·핏·소재·사이즈·가격을 넣어 다시 적어보세요.
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 font-mono text-[12px] uppercase tracking-wide text-ink-soft">
        이해한 조건 ▸
      </span>
      {chips.map((c, i) => (
        <span
          key={i}
          className="inline-flex items-center rounded-full border border-line bg-wall px-3 py-1 text-[13px] font-medium text-ink shadow-sm"
        >
          {c.label}
        </span>
      ))}
    </div>
  );
}
