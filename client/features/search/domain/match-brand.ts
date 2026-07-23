// 유스케이스: 쿼리에서 브랜드(별칭 포함)를 결정적으로 매칭 → canonical. 순수 함수.
// LLM이 아니라 사전 매칭인 이유: 별칭(KOLON·ONSIGHT·레클비)·표기흔들림은 결정적 조회가 정확하다.
export interface BrandEntry {
  canonical: string;
  aliases: string[];
}

export function matchBrand(query: string, brands: BrandEntry[]): string | undefined {
  const low = query.toLowerCase();
  // (alias, canonical) 쌍을 별칭 길이 내림차순으로 — 긴 별칭 우선.
  const pairs = brands
    .flatMap((b) =>
      (b.aliases.length ? b.aliases : [b.canonical]).map(
        (a) => [a.toLowerCase(), b.canonical] as const,
      ),
    )
    .sort((a, b) => b[0].length - a[0].length);
  for (const [alias, canonical] of pairs) {
    if (alias && low.includes(alias)) return canonical;
  }
  return undefined;
}
