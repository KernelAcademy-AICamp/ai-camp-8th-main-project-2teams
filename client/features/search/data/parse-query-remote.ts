"use client";

// 데이터 접근: 자연어 쿼리 → 서버 라우트(/api/parse)의 LLM 파싱으로 Intent를 얻는다.
// 브랜드는 LLM이 아니라 결정적 사전 매칭(matchBrand)으로 파싱 결과 위에 얹는다(LLM/규칙 폴백 공통).
// 실패(네트워크·키 미설정 등) 시 규칙 기반 파서로 폴백해 검색이 멈추지 않게 한다.
import type { Intent } from "@/features/search/domain/intent";
import { type BrandEntry, matchBrand } from "@/features/search/domain/match-brand";
import { parseQuery } from "@/features/search/domain/parse-query";

interface ParseResponse {
  intent?: Intent;
}

// LLM 파싱이 이 시간을 넘으면 규칙 파서로 폴백한다.
// (NVIDIA API가 간헐적으로 30초+ 걸려 "찾기 눌러도 반응 없음"으로 보이는 것을 방지.)
const PARSE_TIMEOUT_MS = 7000;

// 공개 API: 파싱 Intent + 결정적 브랜드 매칭을 합친다. brands는 컴포지션 루트에서 주입.
export async function parseQueryRemote(
  query: string,
  brands: BrandEntry[] = [],
): Promise<Intent> {
  const intent = await parseIntent(query);
  const brand = matchBrand(query, brands);
  return brand ? { ...intent, brand } : intent;
}

// 색·핏·기능성 등 속성 파싱(LLM 우선, 실패 시 규칙 폴백). 브랜드는 여기서 다루지 않는다.
async function parseIntent(query: string): Promise<Intent> {
  if (!query.trim()) return { functional: [] };

  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, PARSE_TIMEOUT_MS);

  try {
    const res = await fetch("/api/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`parse route ${String(res.status)}`);

    const data = (await res.json()) as ParseResponse;
    // functional이 배열이 아니면(빈/불완전 intent) 폴백 — 이후 intent.functional 접근 크래시 방지.
    if (!data.intent || !Array.isArray(data.intent.functional)) {
      throw new Error("invalid intent in response");
    }
    return data.intent;
  } catch {
    // 폴백: 규칙 기반(타임아웃·오프라인·키 없음에서도 검색이 멈추지 않게).
    return parseQuery(query).intent;
  } finally {
    clearTimeout(timer);
  }
}
