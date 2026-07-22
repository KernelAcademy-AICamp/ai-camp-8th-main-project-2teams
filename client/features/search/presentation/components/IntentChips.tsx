// View(시그니처): LLM이 "이해한 조건"을 홀드색 칩으로. 핵심 가치를 눈으로 증명.
// onRemove가 주어지면 각 칩에 × 삭제 버튼을 노출한다(표시 전용 사용처는 미제공).
import { COLOR_HEX } from "@/features/catalog/domain/tee";
import type { IntentChip } from "@/features/search/domain/intent";

export default function IntentChips({
  chips,
  onRemove,
}: {
  chips: IntentChip[];
  onRemove?: (chip: IntentChip) => void;
}) {
  if (chips.length === 0) {
    return (
      <p className="font-mono text-[12px] text-ink-soft">
        조건을 못 알아들었어요. 색·위치·핏·기능성을 넣어 다시 적어보세요.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 font-mono text-[12px] uppercase tracking-wide text-ink-soft">
        이해한 조건 ▸
      </span>
      {chips.map((c, i) => {
        const hex = c.color ? COLOR_HEX[c.color] : undefined;
        return (
          <span
            key={i}
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-wall px-3 py-1 text-[13px] font-medium text-ink shadow-sm"
          >
            {hex && (
              <span
                className="size-3 rounded-full ring-1 ring-black/10"
                style={{ background: hex }}
                aria-hidden
              />
            )}
            {c.label}
            {onRemove && (
              <button
                type="button"
                onClick={() => {
                  onRemove(c);
                }}
                aria-label={`${c.label} 조건 제거`}
                className="-mr-1 ml-0.5 grid size-4 place-items-center rounded-full text-ink-soft transition hover:bg-line hover:text-ink"
              >
                ×
              </button>
            )}
          </span>
        );
      })}
    </div>
  );
}
