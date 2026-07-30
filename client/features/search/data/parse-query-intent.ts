// 서버 전용: NVIDIA LLM으로 자연어 → 구조화 QueryIntent. enum 주입 + validate-drop + 안전 강등.
import {
  COLORS,
  FITS,
  MATERIALS,
  PATTERNS,
} from "@/features/search/data/musinsa-vocab";
import {
  EMPTY_INTENT,
  type QueryIntent,
  type SortIntent,
  type StyleFilter,
} from "@/features/search/domain/query-intent";

const BASE_URL = process.env.NVIDIA_BASE_URL ?? "https://integrate.api.nvidia.com/v1";
const MODEL = process.env.NVIDIA_MODEL ?? "meta/llama-3.1-8b-instruct";

const GENDERS = ["남성", "여성", "공용"] as const;
const SORTS: readonly SortIntent[] = ["relevance", "price_asc", "review_count"];
// promote 가능 키(keywords는 소프트 유지 → 제외)
const PROMOTABLE = ["colors", "patterns", "materials", "fits"] as const;

const SYSTEM_PROMPT = `너는 무신사 반소매 티셔츠 쇼핑몰의 검색어 파서다.
한국어 자연어 검색어를 아래 JSON 스키마로만 변환한다. 설명·코드펜스 없이 JSON 객체 하나만 출력한다.

{
  "gender": "남성" | "여성" | "공용" | null,
  "sizeStd": number[],          // 아래 사이즈 사전으로 변환한 통일 척도(85~120 정수). 없으면 []
  "priceMin": number | null,
  "priceMax": number | null,
  "style": {                    // 각 배열은 아래 목록에서만. 없으면 []
    "colors": string[],
    "patterns": string[],
    "materials": string[],
    "fits": string[],
    "keywords": string[]        // 제목에서 찾을 특징어(그래픽·테마·느낌)+동의어. 일반 의류어·색 제외
  },
  "promote": string[],          // 사용자가 "무조건/반드시/~만"으로 못박은 style 속성 키(colors·patterns·materials·fits)
  "exclude": {                  // "~말고/~빼고/~없는" 대상. 구조는 style과 동일
    "colors": string[], "patterns": string[], "materials": string[], "fits": string[], "keywords": string[]
  },
  "sort": "relevance" | "price_asc" | "review_count"
}

통제 어휘(각 속성은 반드시 이 목록에서만 선택):
- colors: ${COLORS.join(", ")}
- patterns: ${PATTERNS.join(", ")}
- materials: ${MATERIALS.join(", ")}
- fits: ${FITS.join(", ")}

규칙:
- 색: 사용자가 "파랑"처럼 상위색을 말하면 관련 셰이드를 여러 개 담아라(예 파랑→블루, 스카이 블루, 다크 블루, 데님, 연청, 중청, 진청). "무지"→patterns:["단색"], "그래픽/프린팅"→["로고/그래픽","프린트"] 등 의미로 매핑. 목록 밖 값 금지.
- sort: "싼/저렴/가성비"→price_asc, "리뷰 많은/인기"→review_count, 그 외 relevance.
- promote: 강한 강제("무조건 검정만")일 때만 해당 키. 아니면 [].
- keywords: "티","반팔","티셔츠","옷","상의" 같은 일반어와 색은 넣지 마라.
- 명시 안 된 필드는 null 또는 [](추측·환각 금지).

사이즈 사전(반드시 gender와 함께 해석):
- 글자→cm: XS=85, S=90, M=95, L=100, XL=105, XXL=2XL=110, XXXL=3XL=115, 4XL=120, 5XL=125, 6XL=130
- 여성 44체계→cm: 44=85, 55=90, 66=95, 77=100, 88=105 (44반=85)
- 숫자(85~130)는 그대로. "넉넉하게"면 인접 큰 값도 함께(예 105→[105,110]). 프리사이즈는 sizeStd 비움.

예시:
입력: "남성 블랙 오버핏 95 3만원대"
출력: {"gender":"남성","sizeStd":[95],"priceMin":30000,"priceMax":39000,"style":{"colors":["블랙"],"patterns":[],"materials":[],"fits":["오버"],"keywords":[]},"promote":[],"exclude":{"colors":[],"patterns":[],"materials":[],"fits":[],"keywords":[]},"sort":"relevance"}
입력: "면 말고 파란 반팔 싼거"
출력: {"gender":null,"sizeStd":[],"priceMin":null,"priceMax":null,"style":{"colors":["블루","스카이 블루","다크 블루","데님","연청","중청","진청"],"patterns":[],"materials":[],"fits":[],"keywords":[]},"promote":[],"exclude":{"colors":[],"patterns":[],"materials":["면"],"fits":[],"keywords":[]},"sort":"price_asc"}
입력: "무조건 오버핏 그래픽 티"
출력: {"gender":null,"sizeStd":[],"priceMin":null,"priceMax":null,"style":{"colors":[],"patterns":["로고/그래픽","프린트"],"materials":[],"fits":["오버"],"keywords":[]},"promote":["fits"],"exclude":{"colors":[],"patterns":[],"materials":[],"fits":[],"keywords":[]},"sort":"relevance"}`;

interface RawStyle {
  colors?: unknown;
  patterns?: unknown;
  materials?: unknown;
  fits?: unknown;
  keywords?: unknown;
}
interface ParsedRaw {
  gender?: unknown;
  sizeStd?: unknown;
  priceMin?: unknown;
  priceMax?: unknown;
  style?: unknown;
  promote?: unknown;
  exclude?: unknown;
  sort?: unknown;
}

function keepEnum(raw: unknown, allowed: readonly string[]): string[] {
  if (!Array.isArray(raw)) return [];
  const out = raw.filter(
    (x): x is string => typeof x === "string" && allowed.includes(x),
  );
  return [...new Set(out)];
}

function keepFree(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out = raw
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return [...new Set(out)].slice(0, 8);
}

function styleOf(raw: unknown): StyleFilter {
  const s: RawStyle = typeof raw === "object" && raw !== null ? raw : {};
  return {
    colors: keepEnum(s.colors, COLORS),
    patterns: keepEnum(s.patterns, PATTERNS),
    materials: keepEnum(s.materials, MATERIALS),
    fits: keepEnum(s.fits, FITS),
    keywords: keepFree(s.keywords),
  };
}

function positiveInt(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) && v >= 0
    ? Math.round(v)
    : undefined;
}

function sanitize(raw: ParsedRaw): QueryIntent {
  const gender =
    typeof raw.gender === "string" &&
    (GENDERS as readonly string[]).includes(raw.gender)
      ? (raw.gender as QueryIntent["gender"])
      : undefined;
  const sizeStd = Array.isArray(raw.sizeStd)
    ? [
        ...new Set(
          raw.sizeStd.filter(
            (n): n is number =>
              typeof n === "number" && Number.isInteger(n) && n >= 85 && n <= 130,
          ),
        ),
      ]
    : [];
  const promote = Array.isArray(raw.promote)
    ? [
        ...new Set(
          raw.promote.filter(
            (k): k is keyof StyleFilter =>
              typeof k === "string" && (PROMOTABLE as readonly string[]).includes(k),
          ),
        ),
      ]
    : [];
  const sort =
    typeof raw.sort === "string" && (SORTS as readonly string[]).includes(raw.sort)
      ? (raw.sort as SortIntent)
      : "relevance";
  return {
    gender,
    sizeStd,
    priceMin: positiveInt(raw.priceMin),
    priceMax: positiveInt(raw.priceMax),
    style: styleOf(raw.style),
    promote,
    exclude: styleOf(raw.exclude),
    wearChars: EMPTY_INTENT.wearChars,
    sort,
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
    if (typeof obj !== "object" || obj === null) return null;
    const record = obj as Record<string, unknown>;
    return record;
  } catch {
    return null;
  }
}

export async function parseQueryIntent(
  query: string,
  fetchFn: typeof fetch = fetch,
): Promise<{ intent: QueryIntent; degraded: boolean }> {
  const trimmed = query.trim();
  if (!trimmed) return { intent: EMPTY_INTENT, degraded: false };
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) return { intent: EMPTY_INTENT, degraded: true };

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
        max_tokens: 400,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: trimmed },
        ],
      }),
    });
    if (!res.ok) return { intent: EMPTY_INTENT, degraded: true };
    const payload: unknown = await res.json();
    const content = extractContent(payload);
    const raw = content ? parseJsonObject(content) : null;
    if (!raw) return { intent: EMPTY_INTENT, degraded: true };
    return { intent: sanitize(raw), degraded: false };
  } catch {
    return { intent: EMPTY_INTENT, degraded: true };
  }
}
