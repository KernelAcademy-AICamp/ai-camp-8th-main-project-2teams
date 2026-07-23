// Route Handler — 자연어 검색어를 LLM으로 파싱해 검색 의도(Intent)로 변환한다.
// ⚠️ 서버 전용. NVIDIA API 키는 여기서만 접근되며 클라이언트로 노출되지 않는다.
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

// Vercel Hobby 함수 상한(60s) 안에서 여유 있게. LLM 응답이 늦어도 이 안에 끊는다.
export const maxDuration = 30;

const BASE_URL = process.env.NVIDIA_BASE_URL ?? "https://integrate.api.nvidia.com/v1";
const MODEL = process.env.NVIDIA_MODEL ?? "qwen/qwen3-next-80b-a3b-instruct";

const SYSTEM_PROMPT = `너는 클라이밍 프린팅 티셔츠 쇼핑몰의 검색어 파서다.
사용자의 한국어 자연어 검색어를 아래 JSON 스키마로만 변환한다. 설명·코드펜스 없이 JSON 객체 하나만 출력한다.

{
  "baseColor": 바탕(티 몸판) 색 | null,
  "printColor": 프린팅(글씨/그래픽) 색 | null,
  "printPosition": "앞" | "뒤" | "양면" | null,
  "fit": "오버" | "레귤러" | "슬림" | null,
  "graphicType": "레터링" | "캐릭터" | "로고" | "패턴" | "그래픽" | null,
  "gender": "male" | "female" | "unisex" | null,
  "genderExclusive": true | false,  // 공용(남녀공용) 제외 여부
  "functional": string[]  // 아래 목록의 값들만
}

규칙:
- 색은 반드시 이 목록 중 하나: 흰, 검정, 회색, 네이비, 노랑, 빨강, 파랑, 초록, 주황, 분홍, 보라
- functional은 이 목록 중에서만: 냉감, 통풍, 신축, 흡습속건 ("시원한/쿨"→"냉감", "바람 잘 통하는"→"통풍"으로 정규화)
- "등판/뒤/백프린팅"=뒤, "앞/가슴/앞면"=앞
- "바탕/몸판/티 색"은 baseColor, "프린팅/글씨/레터링/로고 색"은 printColor
- gender: "남성/맨즈"=male, "여성/우먼"=female, "남녀공용/공용/유니섹스"=unisex. 성별 언급 없으면 null.
- genderExclusive: "여성 전용/여성만/공용 말고/남녀공용 제외"처럼 공용을 빼달라는 뜻이면 true. 그 외(단순 "여성 티" 등)는 false. gender가 null이면 false.
- ★가장 중요★ 검색어에 명시되지 않은 값은 반드시 null(또는 functional은 빈 배열). 절대 추측·환각하지 마라. 색이 하나만 있으면 그 색만 채우고 나머지 색은 null.

예시:
입력: "회색 무지 티"
출력: {"baseColor":"회색","printColor":null,"printPosition":null,"fit":null,"graphicType":null,"gender":null,"genderExclusive":false,"functional":[]}
입력: "남성 검정 클라이밍 티"
출력: {"baseColor":"검정","printColor":null,"printPosition":null,"fit":null,"graphicType":null,"gender":"male","genderExclusive":false,"functional":[]}
입력: "여성 전용 티 남녀공용 말고"
출력: {"baseColor":null,"printColor":null,"printPosition":null,"fit":null,"graphicType":null,"gender":"female","genderExclusive":true,"functional":[]}
입력: "등판에 검정 레터링 시원한 오버핏"
출력: {"baseColor":null,"printColor":"검정","printPosition":"뒤","fit":"오버","graphicType":"레터링","gender":null,"genderExclusive":false,"functional":["냉감"]}`;

interface ParsedRaw {
  baseColor?: unknown;
  printColor?: unknown;
  printPosition?: unknown;
  fit?: unknown;
  graphicType?: unknown;
  gender?: unknown;
  genderExclusive?: unknown;
  functional?: unknown;
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[]): T | undefined {
  return typeof v === "string" && (allowed as readonly string[]).includes(v)
    ? (v as T)
    : undefined;
}

// LLM이 뱉은 임의 값 → 허용 enum만 통과시켜 안전한 Intent로 정제.
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
    // 공용 제외는 정확 성별(male/female)일 때만 의미. gender 없으면 무시.
    genderExclusive:
      raw.genderExclusive === true && gender !== undefined && gender !== "unisex",
    functional: [...new Set(functional)],
  };
}

// NVIDIA(OpenAI 호환) 응답에서 assistant 텍스트만 안전하게 꺼낸다.
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

// 모델이 코드펜스나 잡설을 섞어도 첫 JSON 객체만 뽑아 파싱.
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

const EMPTY_INTENT: Intent = { functional: [] };

function readQuery(body: unknown): string {
  if (typeof body !== "object" || body === null) return "";
  const q = (body as Record<string, unknown>).query;
  return typeof q === "string" ? q.trim() : "";
}

export async function POST(request: Request): Promise<Response> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "NVIDIA_API_KEY 미설정" }, { status: 500 });
  }

  const body: unknown = await request.json().catch(() => null);
  const query = readQuery(body);

  if (!query) return Response.json({ intent: EMPTY_INTENT });

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.1,
        max_tokens: 200,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: query },
        ],
      }),
    });
  } catch {
    return Response.json({ error: "LLM 요청 실패" }, { status: 502 });
  }

  if (!res.ok) {
    return Response.json(
      { error: `LLM 오류 (${String(res.status)})` },
      { status: 502 },
    );
  }

  const payload: unknown = await res.json();
  const content = extractContent(payload);
  const raw = content ? parseJsonObject(content) : null;
  const intent = raw ? sanitize(raw) : EMPTY_INTENT;

  return Response.json({ intent });
}
