// View: 이미지 중심 결과 카드 — 썸네일 + 브랜드 + 제목 + 가격 + ⭐리뷰. 클릭 시 상세로.
import Image from "next/image";
import Link from "next/link";

import type { Goods } from "@/features/catalog/domain/goods";
import { cardSummary } from "@/features/search/domain/card-summary";
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
    <ul className="tf-grid">
      {goods.map((item, rank) => {
        const summary = cardSummary(item);
        return (
          <li
            key={item.goodsNo}
            className="tf-card"
            style={{ "--i": rank } as React.CSSProperties}
          >
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
            >
              <div className="tf-card__frame">
                {item.thumbnail && (
                  <Image
                    src={item.thumbnail}
                    alt={item.title}
                    fill
                    sizes="(max-width: 640px) 50vw, 25vw"
                  />
                )}
                {summary.length > 0 && (
                  <div className="tf-card__summary" aria-hidden="true">
                    {summary.map((row) => (
                      <div key={row.label} className="tf-card__summary-row">
                        <span className="tf-card__summary-label">{row.label}</span>
                        <span className="tf-card__summary-value">{row.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="tf-card__meta">
                <p className="tf-card__brand">{item.brand}</p>
                <h3 className="tf-card__title">{item.title}</h3>
                <div className="tf-card__row">
                  <span className="tf-card__price">
                    {item.price.toLocaleString()}원
                  </span>
                  {item.reviewCount > 0 && (
                    <span className="tf-card__review">
                      ★ {item.reviewScore.toFixed(1)} ({item.reviewCount})
                    </span>
                  )}
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
