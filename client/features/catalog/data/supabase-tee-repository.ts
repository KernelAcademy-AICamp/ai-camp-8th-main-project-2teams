// Supabase 구현 — products 테이블을 브라우저에서 직접 읽어 Tee로 매핑.
// 추출 속성은 NULL/허용값 밖이면 undefined로 강등(UI가 "미상"으로 degrade).
import {
  COLOR_KEYS,
  type ColorKey,
  type Fit,
  FITS,
  GRAPHIC_TYPES,
  type GraphicType,
  type Material,
  MATERIALS,
  PRINT_POSITIONS,
  type PrintPosition,
  type Tee,
} from "@/features/catalog/domain/tee";

import { supabase } from "./supabase-client";
import type { TeeRepository } from "./tee-repository";

// DB products 행(스냅샷). 추출 속성은 NULL 가능.
interface ProductRow {
  id: string;
  title: string;
  brand: string | null;
  maker: string | null;
  mall_name: string | null;
  lprice: number | null;
  link: string;
  image_url: string | null;
  base_color: string | null;
  print_color: string | null;
  print_position: string | null;
  graphic_type: string | null;
  fit: string | null;
  material: string | null;
  functional: string[] | null;
  sizes: string[] | null;
}

const COLUMNS =
  "id,title,brand,maker,mall_name,lprice,link,image_url," +
  "base_color,print_color,print_position,graphic_type,fit,material,functional,sizes";

// 허용값 배열 안이면 그 값, 아니면 undefined. (NULL·오타·미상 흡수)
function asEnum<T extends string>(
  value: string | null,
  allowed: readonly T[],
): T | undefined {
  return value != null && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined;
}

export function mapRowToTee(row: ProductRow): Tee {
  return {
    id: row.id,
    name: row.title,
    brand: row.brand ?? row.maker ?? "",
    price: row.lprice ?? 0,
    mall: row.mall_name ?? "네이버",
    link: row.link,
    image: row.image_url ?? undefined,
    baseColor: asEnum<ColorKey>(row.base_color, COLOR_KEYS),
    printColor: asEnum<ColorKey>(row.print_color, COLOR_KEYS),
    printPosition: asEnum<PrintPosition>(row.print_position, PRINT_POSITIONS),
    graphicType: asEnum<GraphicType>(row.graphic_type, GRAPHIC_TYPES),
    fit: asEnum<Fit>(row.fit, FITS),
    material: asEnum<Material>(row.material, MATERIALS),
    functional: row.functional ?? [],
    sizes: row.sizes ?? [],
  };
}

export const supabaseTeeRepository: TeeRepository = {
  async getAll(): Promise<Tee[]> {
    const { data, error } = await supabase
      .from("products")
      .select(COLUMNS)
      .order("created_at", { ascending: false });
    if (error) {
      console.warn("[supabaseTeeRepository] getAll 실패:", error.message);
      return [];
    }
    // supabase-js는 Database 제네릭 없이는 콤마 문자열 select를 파싱하지 못해
    // GenericStringError로 추론한다. unknown을 거쳐 우리가 아는 행 타입으로 좁힌다.
    return (data as unknown as ProductRow[]).map(mapRowToTee);
  },

  async getById(id: string): Promise<Tee | null> {
    const { data, error } = await supabase
      .from("products")
      .select(COLUMNS)
      .eq("id", id)
      .maybeSingle();
    if (error) {
      console.warn("[supabaseTeeRepository] getById 실패:", error.message);
      return null;
    }
    return data ? mapRowToTee(data as unknown as ProductRow) : null;
  },
};
