// 결정적 브랜드 매칭 — 쿼리 토큰 n-gram(1~3)을 safe alias 사전에 정확 매칭.
// 경계 없는 includes 금지(부분 문자열 오탐 방지). 긴 n-gram 우선, 동률이면 좌측 우선.
// 입력 aliases는 리포지토리가 hard_filter_safe=true만 로드 → 매칭 성공 = safe(불변식).
import { normalizeBrandKey } from "@/features/search/domain/normalize-brand";

export interface BrandAlias {
  aliasNormalized: string;
  catalogBrand: string;
}

const MAX_NGRAM = 3;

export function matchBrand(query: string, aliases: BrandAlias[]): string | undefined {
  if (!aliases.length) return undefined;

  // 키 → 브랜드. 한 키가 복수 브랜드로 갈리면 모호 → 그 키는 매칭에서 제외(방어).
  const byKey = new Map<string, string | null>();
  for (const a of aliases) {
    const prev = byKey.get(a.aliasNormalized);
    if (prev === undefined) byKey.set(a.aliasNormalized, a.catalogBrand);
    else if (prev !== a.catalogBrand) byKey.set(a.aliasNormalized, null);
  }

  const tokens = query.normalize("NFKC").toLowerCase().split(/\s+/).filter(Boolean);

  // 긴 n-gram 우선 → 동률이면 좌측 우선.
  for (let n = Math.min(MAX_NGRAM, tokens.length); n >= 1; n--) {
    for (let i = 0; i + n <= tokens.length; i++) {
      const key = normalizeBrandKey(tokens.slice(i, i + n).join(""));
      const brand = byKey.get(key);
      if (brand) return brand;
    }
  }
  return undefined;
}
