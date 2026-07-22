// View: 티 색 패널 (목업 이미지) — 바탕색 배경 + 프린팅색 블록 + BACK 태그. 리스트/상세 공용.
import { COLOR_HEX, type ColorKey, type Tee } from "@/features/catalog/domain/tee";

const LIGHT_COLORS: ColorKey[] = ["흰", "노랑", "회색"];
const inkOn = (c: ColorKey) => (LIGHT_COLORS.includes(c) ? "#17181c" : "#ffffff");

export default function TeeSwatch({
  tee,
  className = "",
  showBackTag = true,
  showLabel = true,
}: {
  tee: Tee;
  className?: string;
  showBackTag?: boolean;
  showLabel?: boolean;
}) {
  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden ${className}`}
      style={{ background: COLOR_HEX[tee.baseColor] }}
    >
      {tee.baseColor === "흰" && (
        <div className="absolute inset-0 ring-1 ring-inset ring-black/5" />
      )}
      {showBackTag && tee.printPosition === "뒤" && (
        <span className="absolute left-2 top-2 rounded bg-black/75 px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wide text-white">
          BACK
        </span>
      )}
      <div
        className="grid aspect-square w-3/5 max-w-[45%] place-items-center rounded-xl px-1 text-center font-display text-[13px] font-extrabold uppercase leading-none tracking-tight shadow-sm"
        style={{ background: COLOR_HEX[tee.printColor], color: inkOn(tee.printColor) }}
      >
        {showLabel ? tee.graphicType : ""}
      </div>
    </div>
  );
}
