// Route Handler — 자연어 검색어를 LLM으로 파싱해 Intent + semanticQuery로 변환한다.
// ⚠️ 서버 전용. 파싱 로직은 parse-intent-llm.ts로 이관됐고 여기선 요청/응답만 담당.
import { EMPTY_INTENT, parseIntentLLM } from "@/features/search/data/parse-intent-llm";

export const maxDuration = 30;

function readQuery(body: unknown): string {
  if (typeof body !== "object" || body === null) return "";
  const q = (body as Record<string, unknown>).query;
  return typeof q === "string" ? q.trim() : "";
}

export async function POST(request: Request): Promise<Response> {
  const body: unknown = await request.json().catch(() => null);
  const query = readQuery(body);
  if (!query) return Response.json({ intent: EMPTY_INTENT, semanticQuery: "" });
  const { intent, semanticQuery, degraded } = await parseIntentLLM(query);
  if (degraded) {
    // LLM 파싱 실패(키 미설정·오류) → 502로 알려 parse-query-remote가 규칙 파서로 폴백하게 한다.
    return Response.json({ intent, semanticQuery }, { status: 502 });
  }
  return Response.json({ intent, semanticQuery });
}
