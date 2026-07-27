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
  REVIEW_TAGS_NEGATIVE,
  REVIEW_TAGS_POSITIVE,
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
  "reviewTags": string[],  // 리뷰 기반 "원하는" 태그(아래 [원하는태그]만)
  "excludeTags": string[],  // "피하고 싶은" 결함 태그(아래 [기피태그]만)
  "semanticQuery": string,  // 아래 규칙 참고
  "keywords": string[]  // 제목에서 찾을 특징 단어
}

[원하는태그] (reviewTags — 이 목록 값만):
${REVIEW_TAGS_POSITIVE.join(", ")}

[기피태그] (excludeTags — 이 목록 값만):
${REVIEW_TAGS_NEGATIVE.join(", ")}

규칙:
- 색은 반드시 이 목록 중 하나: 흰, 검정, 회색, 네이비, 노랑, 빨강, 파랑, 초록, 주황, 분홍, 보라
- functional은 냉감·통풍만 여기 넣는다: "시원한/쿨"→"냉감", "바람 잘 통하는/통기성"→"통풍". ※"땀 빨리 마르는/속건/땀 금방 마르는"→reviewTags:["흡습속건"], "신축성 좋은/잘 늘어나는/스판 좋은"→reviewTags:["신축성좋음"] (이 둘은 functional 말고 reviewTags로).
- "등판/뒤/백프린팅"=뒤, "앞/가슴/앞면"=앞
- "바탕/몸판/티 색"은 baseColor, "프린팅/글씨/레터링/로고 색"은 printColor
- gender: "남성/맨즈"=male, "여성/우먼"=female, "남녀공용/공용/유니섹스"=unisex. 성별 언급 없으면 null.
- genderExclusive: "여성 전용/여성만/공용 말고/남녀공용 제외"처럼 공용을 빼달라는 뜻이면 true. 그 외는 false. gender가 null이면 false.
- reviewTags 매핑(alias): "귀여운 그림/캐릭터 이쁜"→디자인귀여움, "선물용/선물하려고"→선물용, "커플룩"→커플티, "암장/볼더링/클라이밍용"→클라이밍, "안 달라붙는"→안달라붙음, "고급스러운"→재질좋음, "면 느낌/면티"→면느낌, "박시한/큼직한"→박시핏, "엉덩이 덮는/힙 커버"→엉덩이커버기장, "쨍한 색"→선명한발색, "톡톡한/도톰한"→도톰함, "두께 적당한/적당한 두께"→두께적당, "각인/이니셜"→각인서비스, "체형 보정/체형 커버/살 가려주는"→체형보정(엉덩이커버기장은 "엉덩이/힙 덮는 기장"일 때만), "건조기 돌려도 되는/건조기 가능"→건조기OK, "털 안 붙는/보푸라기 안 붙는"→털안붙음, "달리기용/러닝하는"→러닝
- ★"튼튼" 구분(중요)★ "튼튼"은 대상에 따라 다르다. **옷/원단/티 자체가 튼튼**("옷이 튼튼한/튼튼한 티/원단 튼튼한/오래 입는/내구성 좋은")→reviewTags:["탄탄함"]. **프린팅/인쇄/그래픽이 튼튼**("프린팅 안 벗겨지는/인쇄 튼튼한/그래픽 오래가는")일 때만 reviewTags:["프린팅튼튼"]. 대상이 명시 안 된 "튼튼한 티"는 원단으로 보고 탄탄함.
- ★극성(중요)★ "안 ~한/~하지 않은/~없는"처럼 결함을 피하려는 표현은, 상대 긍정태그가 있으면 그 긍정태그를 reviewTags(가점)에 넣고 결함태그를 excludeTags(제외)에 넣어 **둘 다** 채운다:
  · "목 안 늘어나는/목 안 늘어짐" → reviewTags:["목안늘어남"], excludeTags:["목늘어남"]
  · "안 비치는/비침 없는" → reviewTags:["비침없음"], excludeTags:["비침있음"]
  · "보풀 안 생기는/보풀 없는" → reviewTags:["보풀안생김"], excludeTags:["보풀생김"]
  · "안 줄어드는/세탁해도 그대로/세탁 후 변형 없는" → reviewTags:["세탁후변형없음"], excludeTags:["세탁후줄어듦"]
  · "안 달라붙는/땀에 안 붙는" → reviewTags:["안달라붙음"], excludeTags:["땀나면달라붙음"]
  · "구김 안 가는/안 구겨지는" → reviewTags:["구김적음"], excludeTags:["구김생김"]
  · "프린팅 안 벗겨지는" → reviewTags:["프린팅튼튼"], excludeTags:["프린팅벗겨짐"]
  · "화면색 그대로/색 안 다른" → reviewTags:["화면색상일치"], excludeTags:["화면과색상다름"]
  · "안 무거운/가벼운" → reviewTags:["가벼움"], excludeTags:["무거움"]
- 상대 긍정태그가 없는 순수 결함어(까슬함·택따가움·먼지잘묻음·물빠짐 등)를 피하려는 표현은 excludeTags만 사용.
- semanticQuery: 검색 의도를 의미검색에 쓸 풍부한 한국어 구절로 확장한다. 위 스키마에 안 담기는 표현(예: "홀로그램", "곰", "레트로", "빈티지")을 반드시 포함하고, 동의어를 덧붙여도 된다. 비면 원문을 그대로 넣는다.
- keywords: 검색 의도의 특징적 단어(그래픽·소재·테마·느낌, 예 "홀로그램","곰","레트로")만 넣는다. "티","티셔츠","반팔","긴팔","옷","셔츠" 같은 일반 의류어와 색은 넣지 마라(색은 baseColor로 처리). 없으면 빈 배열.
- ★가장 중요★ 구조화 필드(색·핏·태그 등)는 명시되지 않으면 반드시 null 또는 빈 배열. 목록에 없는 태그를 지어내지 마라. semanticQuery만 확장을 허용한다.

예시:
입력: "회색 무지 티"
출력: {"baseColor":"회색","printColor":null,"printPosition":null,"fit":null,"graphicType":null,"gender":null,"genderExclusive":false,"functional":[],"reviewTags":[],"excludeTags":[],"semanticQuery":"회색 무지 반팔 티셔츠","keywords":[]}
입력: "선물하기 좋은 귀여운 클라이밍 티"
출력: {"baseColor":null,"printColor":null,"printPosition":null,"fit":null,"graphicType":null,"gender":null,"genderExclusive":false,"functional":[],"reviewTags":["선물용","디자인귀여움","클라이밍"],"excludeTags":[],"semanticQuery":"선물용 귀여운 클라이밍 볼더링 티셔츠","keywords":[]}
입력: "안 비치고 목 안 늘어나는 흰 티"
출력: {"baseColor":"흰","printColor":null,"printPosition":null,"fit":null,"graphicType":null,"gender":null,"genderExclusive":false,"functional":[],"reviewTags":["비침없음","목안늘어남"],"excludeTags":["비침있음","목늘어남"],"semanticQuery":"안 비치는 목 안 늘어나는 흰색 반팔 티셔츠","keywords":[]}`;

interface ParsedRaw {
  baseColor?: unknown;
  printColor?: unknown;
  printPosition?: unknown;
  fit?: unknown;
  graphicType?: unknown;
  gender?: unknown;
  genderExclusive?: unknown;
  functional?: unknown;
  reviewTags?: unknown;
  excludeTags?: unknown;
  semanticQuery?: unknown;
  keywords?: unknown;
}

// 임의 배열 → 허용 목록 안의 문자열만 통과(중복 제거).
function pickTags(v: unknown, allowed: readonly string[]): string[] {
  if (!Array.isArray(v)) return [];
  const set = new Set(allowed);
  return [
    ...new Set(v.filter((x): x is string => typeof x === "string" && set.has(x))),
  ];
}

// 긍정 품질태그 → 짝 결함태그. 긍정을 원하면 결함은 원치 않는 것으로 보고 자동 제외한다.
// (LLM이 극성의 부정쪽을 자주 빠뜨려서 코드로 결정적으로 보장. 값 스펙트럼인 무게 등은 제외.)
const DEFECT_COUNTERPART: Record<string, string> = {
  비침없음: "비침있음",
  보풀안생김: "보풀생김",
  목안늘어남: "목늘어남",
  세탁후변형없음: "세탁후줄어듦",
  프린팅튼튼: "프린팅벗겨짐",
  화면색상일치: "화면과색상다름",
  구김적음: "구김생김",
  안달라붙음: "땀나면달라붙음",
};

const KEYWORD_STOPWORDS = new Set([
  "티",
  "티셔츠",
  "반팔",
  "긴팔",
  "옷",
  "셔츠",
  "반소매",
  "무지",
  "상의",
]);

function toKeywords(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out = raw
    .filter((k): k is string => typeof k === "string")
    .map((k) => k.trim())
    .filter((k) => k.length > 0 && !KEYWORD_STOPWORDS.has(k));
  return [...new Set(out)].slice(0, 8);
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
  const reviewTags = pickTags(raw.reviewTags, REVIEW_TAGS_POSITIVE);
  const excludeFromLLM = pickTags(raw.excludeTags, REVIEW_TAGS_NEGATIVE);
  // 긍정 품질태그의 짝 결함태그를 자동 제외에 합친다(LLM 극성 누락 보정).
  const paired = reviewTags.flatMap((t) => {
    const neg = DEFECT_COUNTERPART[t];
    return neg ? [neg] : [];
  });
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
    reviewTags,
    excludeTags: [...new Set([...excludeFromLLM, ...paired])],
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
): Promise<{
  intent: Intent;
  semanticQuery: string;
  keywords: string[];
  degraded: boolean;
}> {
  const trimmed = query.trim();
  // 빈 쿼리는 실패가 아니다 — degraded:false로 폴백을 트리거하지 않는다.
  if (!trimmed)
    return { intent: EMPTY_INTENT, semanticQuery: "", keywords: [], degraded: false };
  const apiKey = process.env.NVIDIA_API_KEY;
  // 키 미설정은 파싱 실패 — degraded:true로 규칙 파서 폴백을 트리거한다.
  if (!apiKey)
    return {
      intent: EMPTY_INTENT,
      semanticQuery: trimmed,
      keywords: [],
      degraded: true,
    };

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
    if (!res.ok)
      return {
        intent: EMPTY_INTENT,
        semanticQuery: trimmed,
        keywords: [],
        degraded: true,
      };
    const payload: unknown = await res.json();
    const content = extractContent(payload);
    const raw = content ? parseJsonObject(content) : null;
    if (!raw)
      return {
        intent: EMPTY_INTENT,
        semanticQuery: trimmed,
        keywords: [],
        degraded: true,
      };
    const semanticQuery =
      typeof raw.semanticQuery === "string" && raw.semanticQuery.trim()
        ? raw.semanticQuery.trim()
        : trimmed;
    return {
      intent: sanitize(raw),
      semanticQuery,
      keywords: toKeywords(raw.keywords),
      degraded: false,
    };
  } catch {
    return {
      intent: EMPTY_INTENT,
      semanticQuery: trimmed,
      keywords: [],
      degraded: true,
    };
  }
}
