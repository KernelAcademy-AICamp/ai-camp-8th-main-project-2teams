// View: 상품 썸네일 — 실상품 이미지(있으면) → 합성 swatch(색속성 있으면) → 중립 플레이스홀더.
// 리스트/상세 공용.
import Image from "next/image";

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
  // 1) 실상품 이미지 우선.
  if (tee.image) {
    return (
      <div className={`relative overflow-hidden bg-chalk ${className}`}>
        <Image
          src={tee.image}
          alt={tee.name}
          fill
          sizes="(max-width: 640px) 40vw, 320px"
          className="object-cover"
        />
      </div>
    );
  }

  // 2) 색속성이 있으면 합성 swatch.
  if (tee.baseColor && tee.printColor) {
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
          style={{
            background: COLOR_HEX[tee.printColor],
            color: inkOn(tee.printColor),
          }}
        >
          {showLabel ? (tee.graphicType ?? "") : ""}
        </div>
      </div>
    );
  }

  // 3) 둘 다 없음 → 중립 플레이스홀더.
  return (
    <div
      className={`grid place-items-center overflow-hidden bg-chalk text-ink-soft ${className}`}
    >
      <span className="font-mono text-[10px] uppercase tracking-wide">No image</span>
    </div>
  );
}
