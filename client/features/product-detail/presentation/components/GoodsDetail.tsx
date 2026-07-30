"use client";

// product-detail feature: 무신사 상세. 갤러리(경량 캐러셀)·속성·착용감·사이즈(cm)표 → 무신사 아웃바운드.
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import AppHeader from "@/components/AppHeader";
import type { Goods } from "@/features/catalog/domain/goods";
import { buildSizeTable } from "@/features/product-detail/domain/size-table";
import { WEAR_AXES } from "@/features/search/domain/query-intent";
import { track } from "@/shared/analytics";

import { useGoodsDetailViewModel } from "../view-model/use-goods-detail-view-model";

function Gallery({ goods }: { goods: Goods }) {
  const imgs =
    goods.gallery.length > 0 ? goods.gallery : goods.thumbnail ? [goods.thumbnail] : [];
  const [main, setMain] = useState(imgs[0] ?? "");
  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl border border-line bg-chalk">
        {main && (
          <Image
            src={main}
            alt={goods.title}
            fill
            sizes="(max-width: 640px) 100vw, 50vw"
            className="object-cover"
          />
        )}
      </div>
      {imgs.length > 1 && (
        <div className="grid grid-cols-5 gap-2">
          {imgs.slice(0, 10).map((src) => (
            <button
              key={src}
              type="button"
              onClick={() => {
                setMain(src);
              }}
              aria-label="이미지 보기"
              className={`relative aspect-square overflow-hidden rounded-lg border bg-chalk ${src === main ? "border-ink" : "border-line"}`}
            >
              <Image
                src={src}
                alt={goods.title}
                fill
                sizes="20vw"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Badges({ label, values }: { label: string; values: string[] }) {
  if (values.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-mono text-[12px] uppercase tracking-wide text-ink-soft">
        {label}
      </span>
      {values.map((v) => (
        <span
          key={v}
          className="rounded-full border border-line bg-wall px-2.5 py-0.5 text-[13px] text-ink"
        >
          {v}
        </span>
      ))}
    </div>
  );
}

function SizeTableView({ goods }: { goods: Goods }) {
  const table = buildSizeTable(goods.sizeMeasures, goods.color);
  if (table.rows.length === 0 || table.cols.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <span className="font-mono text-[12px] uppercase tracking-wide text-ink-soft">
        사이즈 실측(cm)
      </span>
      <div className="overflow-x-auto rounded-2xl border border-line">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="bg-chalk text-ink-soft">
              <th className="px-3 py-2 text-left font-mono text-[11px] uppercase">
                사이즈
              </th>
              {table.cols.map((c) => (
                <th key={c} className="px-3 py-2 text-right font-mono text-[11px]">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((r) => (
              <tr key={r.name} className="border-t border-line">
                <td className="px-3 py-2 font-semibold text-ink">{r.name}</td>
                {r.cells.map((v, i) => (
                  <td key={i} className="px-3 py-2 text-right text-ink">
                    {v ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function GoodsDetail({ goodsNo }: { goodsNo: string }) {
  const { loading, goods } = useGoodsDetailViewModel(goodsNo);
  const router = useRouter();
  const params = useSearchParams();
  const sid = params.get("sid");
  const [reported, setReported] = useState(false);

  useEffect(() => {
    if (loading) return;
    track("detail_viewed", {
      search_id: sid,
      product_id: goodsNo,
      found: Boolean(goods),
    });
  }, [loading, goods, goodsNo, sid]);

  const wear = goods
    ? WEAR_AXES.flatMap((axis) => {
        const v = goods.wearChars[axis];
        return v ? [`${axis}:${v}`] : [];
      })
    : [];

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-6">
        <button
          type="button"
          onClick={() => {
            router.back();
          }}
          className="mb-5 inline-flex items-center gap-1 font-mono text-[12px] text-ink-soft transition hover:text-ink"
        >
          ← 검색으로
        </button>

        {loading ? (
          <p className="py-20 text-center font-mono text-[13px] text-ink-soft">
            불러오는 중…
          </p>
        ) : !goods ? (
          <div className="grid place-items-center py-20 text-center">
            <p className="font-display text-lg font-bold text-ink">
              상품을 찾을 수 없어요
            </p>
          </div>
        ) : (
          <div className="grid gap-8 sm:grid-cols-2">
            <Gallery goods={goods} />
            <div className="flex flex-col gap-4">
              <div>
                <p className="font-mono text-[12px] uppercase tracking-wide text-ink-soft">
                  {goods.brand}
                </p>
                <h1 className="mt-1 font-display text-2xl font-extrabold leading-tight tracking-tight text-ink">
                  {goods.title}
                </h1>
                <div className="mt-3 flex items-center gap-3">
                  <p className="font-display text-2xl font-bold text-ink">
                    {goods.price.toLocaleString()}
                    <span className="text-sm font-medium text-ink-soft">원</span>
                  </p>
                  {goods.reviewCount > 0 && (
                    <span className="font-mono text-[12px] text-ink-soft">
                      ★ {goods.reviewScore.toFixed(1)} ({goods.reviewCount})
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Badges label="색" values={goods.colors} />
                <Badges label="패턴" values={goods.patterns} />
                <Badges label="소재" values={goods.materials} />
                <Badges label="핏" values={goods.fits} />
                {wear.length > 0 && <Badges label="착용감" values={wear} />}
              </div>

              <SizeTableView goods={goods} />

              <a
                href={goods.url}
                target="_blank"
                rel="noreferrer noopener"
                onClick={() => {
                  track("outbound_click", {
                    search_id: sid,
                    product_id: goods.goodsNo,
                    mall: "무신사",
                    from: "detail",
                  });
                }}
                className="mt-2 rounded-xl bg-ink px-5 py-3 text-center font-display text-sm font-bold text-chalk transition hover:opacity-90"
              >
                무신사에서 구매 →
              </a>
              <p className="text-center font-mono text-[11px] text-ink-soft">
                무신사 상품 페이지로 이동합니다
              </p>

              {!reported ? (
                <button
                  type="button"
                  onClick={() => {
                    track("mismatch_reported", {
                      search_id: sid,
                      product_id: goods.goodsNo,
                    });
                    setReported(true);
                  }}
                  className="w-full font-mono text-[11px] text-ink-soft underline underline-offset-2 transition hover:text-ink"
                >
                  검색 조건과 안 맞아요 · 신고
                </button>
              ) : (
                <p className="text-center font-mono text-[11px] text-ink-soft">
                  신고 접수됐어요. 고맙습니다.
                </p>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
