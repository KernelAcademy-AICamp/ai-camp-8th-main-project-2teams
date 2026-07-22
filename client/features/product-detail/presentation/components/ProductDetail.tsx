"use client";

// product-detail feature: 상세 화면 본체. id로 로드 → 정보 표시 → 구매 진입(outbound).
import Link from "next/link";

import AppHeader from "@/components/AppHeader";
import { COLOR_HEX, type ColorKey } from "@/features/catalog/domain/tee";
import TeeSwatch from "@/features/catalog/presentation/TeeSwatch";
import { track } from "@/shared/analytics";

import { useTeeDetailViewModel } from "../view-model/use-tee-detail-view-model";

function ColorRow({ label, color }: { label: string; color?: ColorKey }) {
  if (!color) return null;
  return (
    <div className="flex items-center gap-2">
      <span
        className="size-4 rounded-full ring-1 ring-black/10"
        style={{ background: COLOR_HEX[color] }}
        aria-hidden
      />
      <span className="font-mono text-[13px] text-ink">
        {color} <span className="text-ink-soft">{label}</span>
      </span>
    </div>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-line py-2.5">
      <span className="font-mono text-[12px] uppercase tracking-wide text-ink-soft">
        {label}
      </span>
      <span className="font-sans text-[14px] font-medium text-ink">{value}</span>
    </div>
  );
}

export default function ProductDetail({ id }: { id: string }) {
  const { loading, tee } = useTeeDetailViewModel(id);

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />

      <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-6">
        <Link
          href="/search"
          className="mb-5 inline-flex items-center gap-1 font-mono text-[12px] text-ink-soft transition hover:text-ink"
        >
          ← 검색으로
        </Link>

        {loading ? (
          <p className="py-20 text-center font-mono text-[13px] text-ink-soft">
            불러오는 중…
          </p>
        ) : !tee ? (
          <div className="grid place-items-center py-20 text-center">
            <p className="font-display text-lg font-bold text-ink">
              상품을 찾을 수 없어요
            </p>
            <Link
              href="/"
              className="mt-3 rounded-xl bg-ink px-4 py-2 font-display text-sm font-bold text-chalk"
            >
              처음으로
            </Link>
          </div>
        ) : (
          <div className="grid gap-8 sm:grid-cols-2">
            {/* 이미지(스와치) */}
            <TeeSwatch
              tee={tee}
              className="aspect-[4/5] w-full rounded-2xl border border-line"
            />

            {/* 정보 */}
            <div className="flex flex-col">
              <p className="font-mono text-[12px] uppercase tracking-wide text-ink-soft">
                {tee.brand} · {tee.mall}
              </p>
              <h1 className="mt-1 font-display text-2xl font-extrabold leading-tight tracking-tight text-ink">
                {tee.name}
              </h1>
              <p className="mt-3 font-display text-2xl font-bold text-ink">
                {tee.price.toLocaleString()}
                <span className="text-sm font-medium text-ink-soft">원</span>
              </p>

              {(tee.baseColor ?? tee.printColor) && (
                <div className="mt-6 flex flex-col gap-2">
                  <ColorRow label="바탕" color={tee.baseColor} />
                  <ColorRow label="프린팅" color={tee.printColor} />
                </div>
              )}

              <div className="mt-6">
                <Spec
                  label="프린팅 위치"
                  value={tee.printPosition ? `${tee.printPosition}면` : "—"}
                />
                <Spec label="그래픽" value={tee.graphicType ?? "—"} />
                <Spec label="핏" value={tee.fit ? `${tee.fit}핏` : "—"} />
                <Spec label="소재" value={tee.material ?? "—"} />
                <Spec
                  label="기능성"
                  value={tee.functional.length ? tee.functional.join(" · ") : "—"}
                />
                <Spec
                  label="사이즈"
                  value={tee.sizes.length ? tee.sizes.join(" · ") : "—"}
                />
              </div>

              {/* 구매 진입(outbound) — 이 클릭이 북극성 전환 이벤트 */}
              <a
                href={tee.link}
                target="_blank"
                rel="noreferrer noopener"
                onClick={() => {
                  track("outbound_click", {
                    product_id: tee.id,
                    mall: tee.mall,
                    from: "detail",
                  });
                }}
                className="mt-7 rounded-xl bg-ink px-5 py-3 text-center font-display text-sm font-bold text-chalk transition hover:opacity-90"
              >
                {tee.mall}에서 보기 →
              </a>
              <p className="mt-2 text-center font-mono text-[11px] text-ink-soft">
                네이버 쇼핑 상품 페이지로 이동합니다
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
