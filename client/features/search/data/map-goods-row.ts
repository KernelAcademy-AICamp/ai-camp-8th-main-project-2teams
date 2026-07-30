// search_goods 뷰 행 → Goods 도메인. 얇은 매핑(뷰가 이미 정제). null 코얼레싱만.
import type { Goods, SizeMeasureRow } from "@/features/catalog/domain/goods";

export interface SearchGoodsRow {
  goods_no: string | number;
  style_key: string | null;
  title: string;
  brand: string | null;
  category: string | null;
  gender: string | null;
  season: string | null;
  color: string | null;
  colors: string[] | null;
  patterns: string[] | null;
  materials: string[] | null;
  fits: string[] | null;
  sizes: string[] | null;
  size_free: boolean | null;
  size_std: number[] | null;
  price: number | null;
  review_count: number | null;
  review_score: number | null;
  gallery: string[] | null;
  url: string | null;
  thumbnail: string | null;
  wear_chars: Record<string, string> | null;
  size_measures: SizeMeasureRow[] | null;
}

export function mapGoodsRow(row: SearchGoodsRow): Goods {
  return {
    goodsNo: String(row.goods_no),
    styleKey: row.style_key ?? "",
    title: row.title,
    brand: row.brand ?? "",
    category: row.category ?? "",
    gender: row.gender ?? "",
    season: row.season ?? undefined,
    color: row.color ?? undefined,
    colors: row.colors ?? [],
    patterns: row.patterns ?? [],
    materials: row.materials ?? [],
    fits: row.fits ?? [],
    sizes: row.sizes ?? [],
    sizeFree: row.size_free ?? false,
    sizeStd: row.size_std ?? [],
    price: row.price ?? 0,
    reviewCount: row.review_count ?? 0,
    reviewScore: row.review_score ?? 0,
    gallery: row.gallery ?? [],
    url: row.url ?? "",
    thumbnail: row.thumbnail ?? "",
    wearChars: row.wear_chars ?? {},
    sizeMeasures: row.size_measures ?? [],
  };
}
