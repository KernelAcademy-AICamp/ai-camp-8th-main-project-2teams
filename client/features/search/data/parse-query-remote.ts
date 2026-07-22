"use client";

// 데이터 접근: 자연어 쿼리 → 서버 라우트(/api/parse)의 LLM 파싱으로 Intent를 얻는다.
// 실패(네트워크·키 미설정 등) 시 규칙 기반 파서로 폴백해 검색이 멈추지 않게 한다.
import type { Intent } from "@/features/search/domain/intent";
import { parseQuery } from "@/features/search/domain/parse-query";

interface ParseResponse {
  intent?: Intent;
}

export async function parseQueryRemote(query: string): Promise<Intent> {
  if (!query.trim()) return { functional: [] };

  try {
    const res = await fetch("/api/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) throw new Error(`parse route ${String(res.status)}`);

    const data = (await res.json()) as ParseResponse;
    if (!data.intent) throw new Error("no intent in response");
    return data.intent;
  } catch {
    // 폴백: 규칙 기반(오프라인/키 없음에서도 기본 검색은 동작).
    return parseQuery(query).intent;
  }
}
