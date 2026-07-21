// View: 간략 결과 리스트 — 행마다 작은 스와치 + 핵심 정보 + 찜. 클릭 시 상세로.
import Link from "next/link";

import SaveButton from "@/features/saved/SaveButton";
import { COLOR_HEX, type Tee } from "@/lib/domain/tee";

import TeeSwatch from "./TeeSwatch";

function Dot({ color }: { color: Tee["baseColor"] }) {
  return (
    <span
      className="inline-block size-2.5 rounded-full ring-1 ring-black/10"
      style={{ background: COLOR_HEX[color] }}
      aria-hidden
    />
  );
}

export default function ResultList({ tees }: { tees: Tee[] }) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-wall">
      {tees.map((tee) => (
        <li key={tee.id}>
          <Link
            href={`/tee/${tee.id}`}
            className="flex items-center gap-4 px-3 py-3 transition hover:bg-chalk sm:px-4"
          >
            <TeeSwatch
              tee={tee}
              showLabel={false}
              className="size-16 shrink-0 rounded-xl border border-line"
            />

            <div className="min-w-0 flex-1">
              <p className="font-mono text-[11px] uppercase tracking-wide text-ink-soft">
                {tee.brand}
              </p>
              <h3 className="truncate font-sans text-[15px] font-semibold text-ink">
                {tee.name}
              </h3>
              <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-[11px] text-ink-soft">
                <span className="inline-flex items-center gap-1">
                  <Dot color={tee.baseColor} />
                  바탕
                  <Dot color={tee.printColor} />
                  프린팅
                </span>
                <span>· {tee.printPosition}면</span>
                <span>· {tee.fit}핏</span>
                {tee.functional[0] && <span>· {tee.functional[0]}</span>}
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-2">
              <span className="font-display text-[15px] font-bold text-ink">
                {tee.price.toLocaleString()}
                <span className="text-[11px] font-medium text-ink-soft">원</span>
              </span>
              <SaveButton id={tee.id} className="size-7 text-base" />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
