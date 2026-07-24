// RPC search_products의 flat 행 → Tee. supabase-tee-repository.mapRowToTee와 동일 규칙이되
// brand는 조인 대신 flat brand_canonical을 쓴다(RPC가 중첩 객체를 못 돌려줌).
import {
  COLOR_KEYS,
  type ColorKey,
  type Fit,
  FITS,
  type Gender,
  GENDERS,
  GRAPHIC_TYPES,
  type GraphicType,
  type Material,
  MATERIALS,
  PRINT_POSITIONS,
  type PrintPosition,
  type Tee,
} from "@/features/catalog/domain/tee";

export interface SearchRow {
  id: string;
  title: string;
  brand: string | null;
  maker: string | null;
  mall_name: string | null;
  lprice: number | null;
  link: string;
  image_url: string | null;
  gender: string | null;
  base_color: string | null;
  print_color: string[] | null;
  print_position: string | null;
  graphic_type: string | null;
  fit: string | null;
  material: string | null;
  functional: string[] | null;
  sizes: string[] | null;
  brand_canonical: string | null;
  score: number;
}

function asEnum<T extends string>(
  value: string | null,
  allowed: readonly T[],
): T | undefined {
  return value != null && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined;
}

export function mapSearchRow(row: SearchRow): Tee {
  return {
    id: row.id,
    name: row.title,
    brand: row.brand ?? row.maker ?? "",
    brandCanonical: row.brand_canonical ?? undefined,
    gender: asEnum<Gender>(row.gender, GENDERS) ?? "unisex",
    price: row.lprice ?? 0,
    mall: row.mall_name ?? "네이버",
    link: row.link,
    image: row.image_url ?? undefined,
    baseColor: asEnum<ColorKey>(row.base_color, COLOR_KEYS),
    printColor: asEnum<ColorKey>(row.print_color?.[0] ?? null, COLOR_KEYS),
    printPosition: asEnum<PrintPosition>(row.print_position, PRINT_POSITIONS),
    graphicType: asEnum<GraphicType>(row.graphic_type, GRAPHIC_TYPES),
    fit: asEnum<Fit>(row.fit, FITS),
    material: asEnum<Material>(row.material, MATERIALS),
    functional: row.functional ?? [],
    sizes: row.sizes ?? [],
  };
}
