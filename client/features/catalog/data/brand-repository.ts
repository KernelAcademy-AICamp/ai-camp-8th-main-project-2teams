// brands 사전 테이블을 읽어 브랜드 매처 입력(BrandEntry[])으로 제공. 실패 시 [](검색은 브랜드 없이 계속).
import type { BrandEntry } from "@/features/search/domain/match-brand";

import { supabase } from "./supabase-client";

interface BrandRow {
  canonical: string;
  aliases: string[] | null;
}

export async function getBrands(): Promise<BrandEntry[]> {
  const { data, error } = await supabase
    .from("brands")
    .select("canonical,aliases")
    .overrideTypes<BrandRow[], { merge: false }>();
  if (error) {
    console.warn("[brand-repository] getBrands 실패:", error.message);
    return [];
  }
  return data.map((r) => ({ canonical: r.canonical, aliases: r.aliases ?? [] }));
}
