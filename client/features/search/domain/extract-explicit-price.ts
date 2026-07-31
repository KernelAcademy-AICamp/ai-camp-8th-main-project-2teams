// 결정적 가격 파서 — 통화 단위(원/만원/천원)가 명시된 표현만 인식한다. LLM 환각(예:
// "2만원 이하"→priceMax=2000 오파싱) 억제용. 단위 없는 숫자(예: "105", "3")는 가격이 아니다.
// 모호한 범위 표현("만원대")은 null로 두어 LLM 파싱에 맡긴다.

export interface ExplicitPrice {
  priceMin?: number;
  priceMax?: number;
}

const MAX_WORDS = ["이하", "이내", "까지", "미만", "언더"];
const MIN_WORDS = ["이상", "부터", "넘는"];

// 우선순위: "N만N천원"(만절 우선) → "N천원" → "N원". "원대"로 이어지면 모호 범위어라 제외.
// ⚠️ 프로젝트 tsconfig target(ES2017)이 정규식 named capturing group 타입 체크를
// 지원하지 않아(TS1503) 번호 캡처 그룹을 쓴다: 1=manWon, 2=manCheon, 3=cheonWon, 4=won.
const PRICE_TOKEN =
  /(\d[\d,]*)\s*만(?:\s*(\d[\d,]*)\s*천)?\s*원(?!\s*대)|(\d[\d,]*)\s*천\s*원(?!\s*대)|(\d[\d,]*)\s*원(?!\s*대)/g;

interface PriceMatch {
  value: number;
  direction: "min" | "max" | null;
}

function toNumber(raw: string): number {
  return Number(raw.replace(/,/g, ""));
}

function detectDirection(rest: string): "min" | "max" | null {
  const m = /^\s*([가-힣]+)/.exec(rest);
  if (!m) return null;
  const word = m[1];
  if (MAX_WORDS.some((w) => word.startsWith(w))) return "max";
  if (MIN_WORDS.some((w) => word.startsWith(w))) return "min";
  return null;
}

export function extractExplicitPrice(query: string): ExplicitPrice | null {
  const matches: PriceMatch[] = [];
  PRICE_TOKEN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = PRICE_TOKEN.exec(query)) !== null) {
    // RegExpExecArray는 모든 원소를 string으로 타입하지만, 대체(|)로 매칭 안 된 캡처
    // 그룹은 런타임에 undefined다(TS의 알려진 부정확성) — 실제 타입으로 캐스트해 반영.
    const [, manWon, manCheon, cheonWon, won] = m as unknown as (string | undefined)[];
    let value: number;
    if (manWon !== undefined) {
      value = toNumber(manWon) * 10000;
      if (manCheon !== undefined) value += toNumber(manCheon) * 1000;
    } else if (cheonWon !== undefined) {
      value = toNumber(cheonWon) * 1000;
    } else if (won !== undefined) {
      value = toNumber(won);
    } else {
      continue;
    }
    const rest = query.slice(m.index + m[0].length);
    matches.push({ value, direction: detectDirection(rest) });
  }
  if (matches.length === 0) return null;

  const result: ExplicitPrice = {};
  const undirected: PriceMatch[] = [];
  for (const match of matches) {
    if (match.direction === "max") result.priceMax = match.value;
    else if (match.direction === "min") result.priceMin = match.value;
    else undirected.push(match);
  }

  if (undirected.length === matches.length && matches.length === 1) {
    // 방향어 없이 가격 하나만 있으면 쇼핑 관례상 예산(상한)으로 해석.
    result.priceMax = undirected[0].value;
  } else {
    for (const match of undirected) {
      if (result.priceMin === undefined) result.priceMin = match.value;
      else result.priceMax ??= match.value;
    }
  }

  if (result.priceMin === undefined && result.priceMax === undefined) return null;
  return result;
}
