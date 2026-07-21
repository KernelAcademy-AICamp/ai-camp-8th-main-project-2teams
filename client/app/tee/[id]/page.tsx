"use client";

// 페이지 3 — /tee/[id] 상세. Next 16: params는 Promise → use()로 언랩.
import Link from "next/link";
import { use } from "react";

import AppHeader from "@/components/AppHeader";
import SaveButton from "@/features/saved/SaveButton";
import TeeSwatch from "@/features/search/components/TeeSwatch";
import { useTeeDetailViewModel } from "@/features/search/view-model/use-tee-detail-view-model";
import { COLOR_HEX, type ColorKey } from "@/lib/domain/tee";

function ColorRow({ label, color }: { label: string; color: ColorKey }) {
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

export default function TeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
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
              <div className="mt-1 flex items-start justify-between gap-3">
                <h1 className="font-display text-2xl font-extrabold leading-tight tracking-tight text-ink">
                  {tee.name}
                </h1>
                <SaveButton
                  id={tee.id}
                  className="size-10 shrink-0 border border-line bg-wall text-xl"
                />
              </div>
              <p className="mt-3 font-display text-2xl font-bold text-ink">
                {tee.price.toLocaleString()}
                <span className="text-sm font-medium text-ink-soft">원</span>
              </p>

              <div className="mt-6 flex flex-col gap-2">
                <ColorRow label="바탕" color={tee.baseColor} />
                <ColorRow label="프린팅" color={tee.printColor} />
              </div>

              <div className="mt-6">
                <Spec label="프린팅 위치" value={`${tee.printPosition}면`} />
                <Spec label="그래픽" value={tee.graphicType} />
                <Spec label="핏" value={`${tee.fit}핏`} />
                <Spec label="소재" value={tee.material} />
                <Spec
                  label="기능성"
                  value={tee.functional.length ? tee.functional.join(" · ") : "—"}
                />
                <Spec label="사이즈" value={tee.sizes.join(" · ")} />
              </div>

              <button
                className="mt-7 rounded-xl bg-ink px-5 py-3 font-display text-sm font-bold text-chalk transition hover:opacity-90"
                title="목업 — 실제 상품 링크는 Loop2 연동"
              >
                상품 보러가기
              </button>
              <p className="mt-2 text-center font-mono text-[11px] text-ink-soft">
                목업 — 실제 쇼핑몰 링크는 데이터 연동 후
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
