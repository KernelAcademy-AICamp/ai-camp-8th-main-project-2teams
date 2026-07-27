// 유스케이스: 이번 렌더에서 검색·칩에 쓸 "작업 의도"를 고른다. 순수 함수.
// 새 파싱이 도착하면(parsed !== prevParsed) 편집 상태(workingIntent)는 다음 렌더에야
// 초기화되므로, 이번 렌더는 갓 도착한 parsed.intent를 써야 desync가 없다.
// (안 그러면 parsing이 먼저 false가 된 한 프레임 동안 낡은 workingIntent로 검색해
// 브랜드 등 제약이 잠깐 사라지고 전체 상품이 튄다.)
import type { Intent } from "@/features/search/domain/intent";

interface Parsed {
  intent: Intent;
}

export function reconcileWorkingIntent(
  parsed: Parsed,
  prevParsed: Parsed,
  workingIntent: Intent,
): Intent {
  return parsed !== prevParsed ? parsed.intent : workingIntent;
}
