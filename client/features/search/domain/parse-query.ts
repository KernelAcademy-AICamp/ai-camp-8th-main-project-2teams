// 유스케이스: 자연어 쿼리 → 검색 의도(Intent) 파싱.
// ⚠️ 규칙 기반 임시 구현. 실제로는 LLM 파싱으로 교체된다 (인터페이스는 유지).
import type { ColorKey, Gender, GraphicType } from "@/features/catalog/domain/tee";
import { GENDER_LABEL } from "@/features/catalog/domain/tee";
import type { Intent, IntentChip } from "@/features/search/domain/intent";

const COLOR_WORDS: Record<string, ColorKey> = {
  흰: "흰",
  하양: "흰",
  화이트: "흰",
  백: "흰",
  검: "검정",
  검정: "검정",
  블랙: "검정",
  회: "회색",
  그레이: "회색",
  회색: "회색",
  네이비: "네이비",
  곤: "네이비",
  노랑: "노랑",
  노란: "노랑",
  옐로: "노랑",
  빨강: "빨강",
  빨간: "빨강",
  레드: "빨강",
  파랑: "파랑",
  파란: "파랑",
  블루: "파랑",
  초록: "초록",
  그린: "초록",
  주황: "주황",
  오렌지: "주황",
  분홍: "분홍",
  핑크: "분홍",
  보라: "보라",
  퍼플: "보라",
};

export function parseQuery(q: string): { intent: Intent; chips: IntentChip[] } {
  const text = q.toLowerCase();
  const intent: Intent = { functional: [] };
  const chips: IntentChip[] = [];

  // 프린팅 위치 (등판/백프린팅 → 뒤)
  if (/등판|백프린|뒤|등에|back/.test(text)) {
    intent.printPosition = "뒤";
    chips.push({ label: "등판", kind: "position" });
  } else if (/앞|가슴|front/.test(text)) {
    intent.printPosition = "앞";
    chips.push({ label: "앞면", kind: "position" });
  }

  // 색 — 색 바로 뒤의 토큰으로 "프린팅색" vs "바탕색"을 판정.
  // 긴 색 이름 우선(검정>검) + 이미 매칭된 색 단어 범위 안의 짧은 별칭은 건너뛴다.
  const colorEntries = Object.entries(COLOR_WORDS).sort(
    (a, b) => b[0].length - a[0].length,
  );
  const usedRanges: [number, number][] = [];
  for (const [word, color] of colorEntries) {
    const idx = text.indexOf(word);
    if (idx < 0) continue;
    if (usedRanges.some(([s, e]) => idx >= s && idx < e)) continue;
    usedRanges.push([idx, idx + word.length]);
    const nextToken =
      text
        .slice(idx + word.length)
        .trimStart()
        .split(/\s+/)[0] ?? "";
    const printHint = /프린|글씨|레터|로고|그래픽|프린팅/.test(nextToken);
    const baseHint = /바탕|몸판|티|셔츠|무지/.test(nextToken);
    const isPrint =
      printHint || (!!intent.printPosition && !intent.printColor && !baseHint);
    if (isPrint) {
      if (!intent.printColor) {
        intent.printColor = color;
        chips.push({ label: `${color} 프린팅`, kind: "print", color });
      }
    } else if (!intent.baseColor) {
      intent.baseColor = color;
      chips.push({ label: `${color} 바탕`, kind: "base", color });
    }
  }

  // 핏
  if (/오버핏|오버|루즈|박시/.test(text)) {
    intent.fit = "오버";
    chips.push({ label: "오버핏", kind: "fit" });
  } else if (/슬림|타이트|핏하게/.test(text)) {
    intent.fit = "슬림";
    chips.push({ label: "슬림핏", kind: "fit" });
  }

  // 기능성 / 느낌
  const fnMap: Record<string, string> = {
    시원: "냉감",
    냉감: "냉감",
    쿨: "냉감",
    산들: "통풍",
    통풍: "통풍",
    바람: "통풍",
    흡습: "흡습속건",
    속건: "흡습속건",
    신축: "신축",
    스트레치: "신축",
    기능성: "통풍",
  };
  for (const [word, fn] of Object.entries(fnMap)) {
    if (text.includes(word) && !intent.functional.includes(fn)) {
      intent.functional.push(fn);
      chips.push({ label: fn, kind: "functional" });
    }
  }

  // 그래픽 유형
  const gMap: Record<string, GraphicType> = {
    레터링: "레터링",
    글씨: "레터링",
    문구: "레터링",
    캐릭터: "캐릭터",
    로고: "로고",
    패턴: "패턴",
    그래픽: "그래픽",
  };
  for (const [word, g] of Object.entries(gMap)) {
    if (text.includes(word) && !intent.graphicType) {
      intent.graphicType = g;
      chips.push({ label: g, kind: "graphic" });
    }
  }

  // 성별 (쿼리 의도 — 신호 없으면 미설정)
  // "공용 말고/제외/빼고/아닌" 또는 "전용/오직/성별+만"이면 공용을 배제(genderExclusive).
  const excludeUnisex =
    /(남녀\s*공용|공용|유니섹스|unisex)\s*(말고|빼고|뺀|제외|아닌|아니)/.test(text) ||
    /전용|오직/.test(text) ||
    /(남성|여성|남자|여자)만/.test(text);
  let gender: Gender | undefined;
  // 순수 공용(배제 신호가 아닐 때)만 unisex로 본다.
  if (!excludeUnisex && /남녀\s*공용|공용|유니섹스|unisex|커플|남녀/.test(text))
    gender = "unisex";
  else if (/여성|여자|우먼|우먼스|women|woman|female|레이디|걸/.test(text))
    gender = "female";
  else if (/남성|남자|맨즈|맨스|mens|men|male|man/.test(text)) gender = "male";
  if (gender) {
    intent.gender = gender;
    // 공용 배제는 정확 성별(male/female)일 때만 의미가 있다(unisex 전용은 no-op).
    const exclusive = excludeUnisex && gender !== "unisex";
    if (exclusive) intent.genderExclusive = true;
    const label = exclusive ? `${GENDER_LABEL[gender]} 전용` : GENDER_LABEL[gender];
    chips.push({ label, kind: "gender" });
  }

  return { intent, chips };
}
