// 서버 전용 — search_brand_aliases에서 safe alias만 로드. 모듈 캐시(TTL 5분).
// 실패는 throw — 설계 §4.4: DB/사전 조회 실패 → mode "failed"(호출자 처리).
import type { BrandAlias } from "@/features/search/domain/match-brand";

interface AliasRow {
  alias_normalized: string;
  catalog_brand: string;
}

// route의 supabase 클라이언트가 구조적으로 만족하는 최소 표면.
export interface AliasDb {
  from(table: string): {
    select(columns: string): {
      eq(
        column: string,
        value: unknown,
      ): PromiseLike<{
        data: AliasRow[] | null;
        error: unknown;
      }>;
    };
  };
}

const TTL_MS = 5 * 60_000;
let cache: { at: number; aliases: BrandAlias[] } | null = null;

export function _clearAliasCache(): void {
  cache = null;
}

export async function getSafeBrandAliases(db: AliasDb): Promise<BrandAlias[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.aliases;
  const { data, error } = await db
    .from("search_brand_aliases")
    .select("alias_normalized,catalog_brand")
    .eq("hard_filter_safe", true);
  if (error || !data) {
    throw new Error("search_brand_aliases 조회 실패");
  }
  const aliases = data.map((r) => ({
    aliasNormalized: r.alias_normalized,
    catalogBrand: r.catalog_brand,
  }));
  cache = { at: Date.now(), aliases };
  return aliases;
}
