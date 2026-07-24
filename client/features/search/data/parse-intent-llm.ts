// 서버 전용: NVIDIA LLM으로 자연어 쿼리 → 구조화 Intent + 의미검색용 확장 텍스트.
// (기존 app/api/parse/route.ts의 파싱 로직을 이관. route는 이 헬퍼의 얇은 래퍼가 된다.)
import {
  COLOR_KEYS,
  type ColorKey,
  type Fit,
  FITS,
  FUNCTIONALS,
  type Gender,
  GENDERS,
  GRAPHIC_TYPES,
  type GraphicType,
  PRINT_POSITIONS,
  type PrintPosition,
} from "@/features/catalog/domain/tee";
import type { Intent } from "@/features/search/domain/intent";

const BASE_URL = process.env.NVIDIA_BASE_URL ?? "https://integrate.api.nvidia.com/v1";
const MODEL = process.env.NVIDIA_MODEL ?? "meta/llama-3.1-8b-instruct";
export const EMPTY_INTENT: Intent = { functional: [] };

const SYSTEM_PROMPT = `너는 클라이밍 프린팅 티셔츠 쇼핑몰의 검색어 파서다.
사용자의 한국어 자연어 검색어를 아래 JSON 스키마로만 변환한다. 설명·코드펜스 없이 JSON 객체 하나만 출력한다.

{
  "baseColor": 바탕(티 몸판) 색 | null,
  "printColor": 프린팅(글씨/그래픽) 색 | null,
  "printPosition": "앞" | "뒤" | "양면" | null,
  "fit": "오버" | "레귤러" | "슬림" | null,
  "graphicType": "레터링" | "캐릭터" | "로고" | "패턴" | "그래픽" | null,
  "gender": "male" | "female" | "unisex" | null,
  "genderExclusive": true | false,
  "functional": string[],
  "semanticQuery": string  // 아래 규칙 참고
}

규칙:
- 색은 반드시 이 목록 중 하나: 흰, 검정, 회색, 네이비, 노랑, 빨강, 파랑, 초록, 주황, 분홍, 보라
- functional은 이 목록 중에서만: 냉감, 통풍, 신축, 흡습속건 ("시원한/쿨"→"냉감", "바람 잘 통하는"→"통풍")
- "등판/뒤/백프린팅"=뒤, "앞/가슴/앞면"=앞
- "바탕/몸판/티 색"은 baseColor, "프린팅/글씨/레터링/로고 색"은 printColor
- gender: "남성/맨즈"=male, "여성/우먼"=female, "남녀공용/공용/유니섹스"=unisex. 성별 언급 없으면 null.
- genderExclusive: "여성 전용/여성만/공용 말고/남녀공용 제외"처럼 공용을 빼달라는 뜻이면 true. 그 외는 false. gender가 null이면 false.
- semanticQuery: 검색 의도를 의미검색에 쓸 풍부한 한국어 구절로 확장한다. 위 스키마에 안 담기는 표현(예: "홀로그램", "곰", "레트로", "빈티지")을 반드시 포함하고, 동의어를 덧붙여도 된다. 비면 원문을 그대로 넣는다.
- ★가장 중요★ 구조화 필드(색·핏 등)는 명시되지 않으면 반드시 null(functional은 빈 배열). 추측·환각 금지. semanticQuery만 확장을 허용한다.

예시:
입력: "회색 무지 티"
출력: {"baseColor":"회색","printColor":null,"printPosition":null,"fit":null,"graphicType":null,"gender":null,"genderExclusive":false,"functional":[],"semanticQuery":"회색 무지 반팔 티셔츠"}
입력: "홀로그램 느낌나는 티셔츠"
출력: {"baseColor":null,"printColor":null,"printPosition":null,"fit":null,"graphicType":null,"gender":null,"genderExclusive":false,"functional":[],"semanticQuery":"홀로그램 메탈릭 반짝이는 홀로그램 그래픽 티셔츠"}`;

interface ParsedRaw {
  baseColor?: unknown;
  printColor?: unknown;
  printPosition?: unknown;
  fit?: unknown;
  graphicType?: unknown;
  gender?: unknown;
  genderExclusive?: unknown;
  functional?: unknown;
  semanticQuery?: unknown;
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[]): T | undefined {
  return typeof v === "string" && (allowed as readonly string[]).includes(v)
    ? (v as T)
    : undefined;
}

function sanitize(raw: ParsedRaw): Intent {
  const functional = Array.isArray(raw.functional)
    ? raw.functional.filter(
        (f): f is string => typeof f === "string" && FUNCTIONALS.includes(f),
      )
    : [];
  const gender = oneOf<Gender>(raw.gender, GENDERS);
  return {
    baseColor: oneOf<ColorKey>(raw.baseColor, COLOR_KEYS),
    printColor: oneOf<ColorKey>(raw.printColor, COLOR_KEYS),
    printPosition: oneOf<PrintPosition>(raw.printPosition, PRINT_POSITIONS),
    fit: oneOf<Fit>(raw.fit, FITS),
    graphicType: oneOf<GraphicType>(raw.graphicType, GRAPHIC_TYPES),
    gender,
    genderExclusive:
      raw.genderExclusive === true && gender !== undefined && gender !== "unisex",
    functional: [...new Set(functional)],
  };
}

function extractContent(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const choices = (payload as Record<string, unknown>).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const first: unknown = choices[0];
  if (typeof first !== "object" || first === null) return null;
  const message = (first as Record<string, unknown>).message;
  if (typeof message !== "object" || message === null) return null;
  const content = (message as Record<string, unknown>).content;
  return typeof content === "string" ? content : null;
}

function parseJsonObject(text: string): ParsedRaw | null {
  const match = /\{[\s\S]*\}/.exec(text);
  if (!match) return null;
  try {
    const obj: unknown = JSON.parse(match[0]);
    return typeof obj === "object" && obj !== null ? obj : null;
  } catch {
    return null;
  }
}

export async function parseIntentLLM(
  query: string,
  fetchFn: typeof fetch = fetch,
): Promise<{ intent: Intent; semanticQuery: string }> {
  const trimmed = query.trim();
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!trimmed || !apiKey) return { intent: EMPTY_INTENT, semanticQuery: trimmed };

  try {
    const res = await fetchFn(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.1,
        max_tokens: 300,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: trimmed },
        ],
      }),
    });
    if (!res.ok) return { intent: EMPTY_INTENT, semanticQuery: trimmed };
    const payload: unknown = await res.json();
    const content = extractContent(payload);
    const raw = content ? parseJsonObject(content) : null;
    if (!raw) return { intent: EMPTY_INTENT, semanticQuery: trimmed };
    const semanticQuery =
      typeof raw.semanticQuery === "string" && raw.semanticQuery.trim()
        ? raw.semanticQuery.trim()
        : trimmed;
    return { intent: sanitize(raw), semanticQuery };
  } catch {
    return { intent: EMPTY_INTENT, semanticQuery: trimmed };
  }
}
