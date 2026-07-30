// View: 이미지 중심 결과 카드 — 썸네일 + 브랜드 + 제목 + 가격 + ⭐리뷰. 클릭 시 상세로.
import Image from "next/image";
import Link from "next/link";

import type { Goods } from "@/features/catalog/domain/goods";
import { track } from "@/shared/analytics";
import type { ResultType } from "@/shared/analytics-params";

export default function ResultList({
  goods,
  searchId,
  resultType,
}: {
  goods: Goods[];
  searchId: string;
  resultType: ResultType;
}) {
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {goods.map((item, rank) => (
        <li key={item.goodsNo}>
          <Link
            href={`/goods/${item.goodsNo}?sid=${encodeURIComponent(searchId)}&rank=${rank}&rt=${resultType}`}
            onClick={() => {
              track("result_clicked", {
                search_id: searchId,
                product_id: item.goodsNo,
                rank,
                result_type: resultType,
              });
            }}
            className="group block overflow-hidden rounded-2xl border border-line bg-wall transition hover:shadow-md"
          >
            <div className="relative aspect-square overflow-hidden bg-chalk">
              {item.thumbnail && (
                <Image
                  src={item.thumbnail}
                  alt={item.title}
                  fill
                  sizes="(max-width: 640px) 50vw, 25vw"
                  className="object-cover transition group-hover:scale-105"
                />
              )}
            </div>
            <div className="p-3">
              <p className="truncate font-mono text-[11px] uppercase tracking-wide text-ink-soft">
                {item.brand}
              </p>
              <h3 className="mt-0.5 line-clamp-2 min-h-[2.5em] font-sans text-[14px] font-semibold text-ink">
                {item.title}
              </h3>
              <div className="mt-1.5 flex items-center justify-between">
                <span className="font-display text-[15px] font-bold text-ink">
                  {item.price.toLocaleString()}
                  <span className="text-[11px] font-medium text-ink-soft">원</span>
                </span>
                {item.reviewCount > 0 && (
                  <span className="font-mono text-[11px] text-ink-soft">
                    ★ {item.reviewScore.toFixed(1)} ({item.reviewCount})
                  </span>
                )}
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
