# Phase 1.5a — wear_chars 소프트 축 검색 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** LLM이 "부드부드한/시원한" 같은 구어를 무신사 `wear_chars`(착용감) 실재값에 연결해 검색 랭킹에 반영한다.

**Architecture:** 스펙 [Phase 1.5](../specs/2026-07-30-musinsa-llm-weighted-search-design.md)의 실용 증분(A). `wear_chars`를 **소프트 점수 축**으로 추가한다(하드 필터 아님 — 41% 커버리지라 배제 금지). LLM 프롬프트엔 **축별 유효값 목록만 주입**(손으로 쓴 구어→캐논 매핑표 없음). 검증은 통제어휘 밖 값을 드롭(fail-closed). 소프트 축이라 빈결과·relaxation 문제 없음 → DSL 엔진·완화 루프는 이 플랜 범위 밖(Phase 1.5b 백로그).

**Tech Stack:** Next.js(TS, App Router) · vitest · Supabase(`search_goods` 뷰) · NVIDIA LLM(`parse-query-intent`).

## Global Constraints

- `wear_chars`는 **소프트 점수 축만**. 하드 필터(WHERE)로 쓰지 말 것.
- LLM 프롬프트엔 **유효값 목록만** 주입. 구어→캐논 매핑 규칙을 손으로 나열하지 말 것(LLM 언어지식에 위임).
- 통제어휘 밖 값은 **드롭**(fail-closed). 값 문자열은 DB와 **정확 일치**(파이프 포맷 `약간|부드러움` 그대로 보존, 변형 금지).
- 레이어: 도메인(`domain/`)은 데이터(`data/`)를 import하지 않는다. 축 이름·타입=도메인, 유효값 목록=데이터.
- 완료 게이트: `client/`에서 `npm run check`(lint+typecheck+format:check) 그린.
- 커밋: 한글 Conventional Commits + 트레일러 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. 모든 경로는 `client/` 기준.

---

### Task 1: 도메인에 wear_chars 축·타입 추가

**Files:**
- Modify: `features/search/domain/query-intent.ts`
- Test: `features/search/domain/query-intent.test.ts` (create)

**Interfaces:**
- Produces: `WEAR_AXES: readonly ["촉감","두께","비침","신축성","계절","핏"]`, `type WearAxis`, `type WearCharsFilter = Record<WearAxis, string[]>`, `QueryIntent.wearChars: WearCharsFilter`, `EMPTY_INTENT.wearChars`(전 축 `[]`).

- [ ] **Step 1: Write the failing test**

```ts
// features/search/domain/query-intent.test.ts
import { describe, expect, it } from "vitest";

import { EMPTY_INTENT, WEAR_AXES } from "@/features/search/domain/query-intent";

describe("query-intent wearChars", () => {
  it("WEAR_AXES는 6개 착용감 축", () => {
    expect(WEAR_AXES).toEqual(["촉감", "두께", "비침", "신축성", "계절", "핏"]);
  });

  it("EMPTY_INTENT.wearChars는 전 축 빈 배열", () => {
    expect(EMPTY_INTENT.wearChars).toEqual({
      촉감: [], 두께: [], 비침: [], 신축성: [], 계절: [], 핏: [],
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run features/search/domain/query-intent.test.ts`
Expected: FAIL — `WEAR_AXES` is not exported / `wearChars` undefined.

- [ ] **Step 3: Implement**

`features/search/domain/query-intent.ts` — 상단 타입 근처에 추가:

```ts
// 착용감 축(도메인 형상). 유효값 목록은 data/wear-chars-vocab.ts.
export const WEAR_AXES = ["촉감", "두께", "비침", "신축성", "계절", "핏"] as const;
export type WearAxis = (typeof WEAR_AXES)[number];
export type WearCharsFilter = Record<WearAxis, string[]>;

function emptyWear(): WearCharsFilter {
  return WEAR_AXES.reduce<WearCharsFilter>(
    (acc, axis) => ({ ...acc, [axis]: [] }),
    {} as WearCharsFilter,
  );
}
```

`QueryIntent` 인터페이스에 필드 추가(‑ `exclude` 아래):

```ts
  exclude: StyleFilter; // NOT 필터
  wearChars: WearCharsFilter; // 착용감 소프트 축(촉감·두께·비침·신축성·계절·핏)
  sort: SortIntent;
```

`EMPTY_INTENT`에 추가:

```ts
export const EMPTY_INTENT: QueryIntent = {
  sizeStd: [],
  style: emptyStyle(),
  promote: [],
  exclude: emptyStyle(),
  wearChars: emptyWear(),
  sort: "relevance",
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run features/search/domain/query-intent.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add features/search/domain/query-intent.ts features/search/domain/query-intent.test.ts
git commit -m "feat: QueryIntent에 wear_chars 착용감 축 추가

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: wear_chars 유효값 어휘 상수

**Files:**
- Create: `features/search/data/wear-chars-vocab.ts`
- Test: `features/search/data/wear-chars-vocab.test.ts` (create)

**Interfaces:**
- Consumes: `WearAxis`, `WEAR_AXES` (Task 1).
- Produces: `WEAR_CHARS_VOCAB: Record<WearAxis, readonly string[]>` — 축별 서열순 유효값(2026-07-30 `search_goods` distinct).

- [ ] **Step 1: Write the failing test**

```ts
// features/search/data/wear-chars-vocab.test.ts
import { describe, expect, it } from "vitest";

import { WEAR_CHARS_VOCAB } from "@/features/search/data/wear-chars-vocab";
import { WEAR_AXES } from "@/features/search/domain/query-intent";

describe("WEAR_CHARS_VOCAB", () => {
  it("모든 축을 덮고 빈 축이 없다", () => {
    for (const axis of WEAR_AXES) {
      expect(WEAR_CHARS_VOCAB[axis].length).toBeGreaterThan(0);
    }
  });

  it("파이프 포맷을 원문 그대로 보존한다", () => {
    expect(WEAR_CHARS_VOCAB["촉감"]).toContain("약간|부드러움");
    expect(WEAR_CHARS_VOCAB["핏"]).toContain("오버|사이즈");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run features/search/data/wear-chars-vocab.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// features/search/data/wear-chars-vocab.ts
// 무신사 착용감 통제 어휘 — search_goods.wear_chars 축별 distinct 값(서열순, 2026-07-30).
// LLM 프롬프트엔 이 목록만 주입(손 매핑 금지). 값은 DB와 정확 일치(파이프 포맷 보존).
import type { WearAxis } from "@/features/search/domain/query-intent";

export const WEAR_CHARS_VOCAB: Record<WearAxis, readonly string[]> = {
  촉감: ["부드러움", "약간|부드러움", "보통", "약간|뻣뻣함"],
  두께: ["얇음", "약간 얇음", "보통", "약간|두꺼움", "두꺼움"],
  비침: ["없음", "거의 없음", "보통", "약간 있음", "있음"],
  신축성: ["있음", "약간 있음", "보통", "거의 없음", "없음"],
  계절: ["봄", "여름"],
  핏: ["레귤러", "오버|사이즈", "슬림", "루즈", "스키니"],
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run features/search/data/wear-chars-vocab.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add features/search/data/wear-chars-vocab.ts features/search/data/wear-chars-vocab.test.ts
git commit -m "feat: wear_chars 착용감 통제 어휘 상수 추가

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Goods 도메인·행 매핑에 wearChars 배선

**Files:**
- Modify: `features/catalog/domain/goods.ts`
- Modify: `features/search/data/map-goods-row.ts`
- Test: `features/search/data/map-goods-row.test.ts` (add cases)

**Interfaces:**
- Produces: `Goods.wearChars: Record<string, string>`(상품의 축별 단일값), `SearchGoodsRow.wear_chars: Record<string, string> | null`, `mapGoodsRow`가 `wear_chars`를 매핑(null→`{}`).

- [ ] **Step 1: Write the failing test**

`features/search/data/map-goods-row.test.ts` **하단에 describe만 추가**(파일 상단의 `import`·`base` 리터럴 재사용, 중복 선언 금지). `{ ...base, wear_chars }` 스프레드로 케이스를 만든다:

```ts
describe("mapGoodsRow wearChars", () => {
  it("wear_chars 딕셔너리를 그대로 매핑", () => {
    const g = mapGoodsRow({ ...base, wear_chars: { 촉감: "부드러움", 두께: "얇음" } });
    expect(g.wearChars).toEqual({ 촉감: "부드러움", 두께: "얇음" });
  });

  it("null이면 빈 객체", () => {
    const g = mapGoodsRow({ ...base, wear_chars: null });
    expect(g.wearChars).toEqual({});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run features/search/data/map-goods-row.test.ts`
Expected: FAIL — `SearchGoodsRow` has no `wear_chars` / `Goods` has no `wearChars`.

- [ ] **Step 3: Implement**

`features/catalog/domain/goods.ts` — `thumbnail` 아래 필드 추가:

```ts
  thumbnail: string;
  wearChars: Record<string, string>; // 착용감 축별 단일값(촉감·두께·비침·신축성·계절·핏)
}
```

`features/search/data/map-goods-row.ts` — `SearchGoodsRow`에 필드 추가(‑ `thumbnail` 아래):

```ts
  thumbnail: string | null;
  wear_chars: Record<string, string> | null;
}
```

같은 파일 `mapGoodsRow` 반환 객체에 추가(‑ `thumbnail` 아래):

```ts
    thumbnail: row.thumbnail ?? "",
    wearChars: row.wear_chars ?? {},
  };
```

**필수 필드 추가로 깨지는 기존 테스트 리터럴 3곳을 함께 갱신**(안 하면 Task 6의 `npm run check` typecheck 실패). vitest는 타입을 벗겨 실행하므로 이 태스크의 테스트는 통과하지만, tsc는 누락을 잡는다:

- `features/search/data/map-goods-row.test.ts` 상단 `const base: SearchGoodsRow`에 한 줄 추가: `  wear_chars: null,`
- `features/search/domain/score-row.test.ts`의 `goods(p)` 팩토리 기본값에 추가: `    wearChars: {},`
- `features/search/domain/rank-goods.test.ts`의 `goods(p)` 팩토리 기본값에 추가: `    wearChars: {},`

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run features/search/data/map-goods-row.test.ts`
Expected: PASS (기존 + 신규 2).

- [ ] **Step 5: Commit**

```bash
git add features/catalog/domain/goods.ts features/search/data/map-goods-row.ts \
  features/search/data/map-goods-row.test.ts features/search/domain/score-row.test.ts \
  features/search/domain/rank-goods.test.ts
git commit -m "feat: Goods·행매핑에 wearChars 배선

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: 소프트 스코어에 wear_chars 매칭 반영

**Files:**
- Modify: `features/search/domain/score-row.ts`
- Test: `features/search/domain/score-row.test.ts` (add cases)

**Interfaces:**
- Consumes: `Goods.wearChars`(Task 3), `QueryIntent.wearChars`·`WEAR_AXES`(Task 1).
- Produces: `styleScore`가 축별 매칭당 `WEIGHTS.wear` 가점. `WEIGHTS.wear = 2`.

- [ ] **Step 1: Write the failing test**

`features/search/domain/score-row.test.ts` **하단에 describe만 추가**. 이 파일의 기존 로컬 팩토리 `goods(p)`·`intent(p)`와 이미 import된 `EMPTY_INTENT`·`styleScore`를 재사용한다(중복 선언·import 금지). `goods` 팩토리엔 Task 3에서 `wearChars: {}` 기본값이 이미 추가돼 있어야 한다:

```ts
describe("styleScore wearChars", () => {
  it("착용감 축 값이 일치하면 가점", () => {
    const g = goods({ wearChars: { 촉감: "부드러움" } });
    const i = intent({ wearChars: { ...EMPTY_INTENT.wearChars, 촉감: ["부드러움", "약간|부드러움"] } });
    expect(styleScore(g, i)).toBe(2);
  });

  it("불일치·미보유는 0점", () => {
    const g = goods({ wearChars: { 촉감: "보통" } });
    const i = intent({ wearChars: { ...EMPTY_INTENT.wearChars, 촉감: ["부드러움"] } });
    expect(styleScore(g, i)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run features/search/domain/score-row.test.ts`
Expected: FAIL — 착용감 미채점으로 0점.

- [ ] **Step 3: Implement**

`features/search/domain/score-row.ts`:

import 교체(‑ `WEAR_AXES` 추가):

```ts
import { type QueryIntent, type StyleFilter, WEAR_AXES } from "@/features/search/domain/query-intent";
```

`WEIGHTS`에 `wear` 추가:

```ts
export const WEIGHTS = {
  colors: 3, patterns: 2, materials: 2, fits: 2, keyword: 3, wear: 2,
} as const;
```

`styleScore` 안 `keywords` 루프 다음, `return s;` 직전에 추가:

```ts
  for (const axis of WEAR_AXES) {
    const wanted = intent.wearChars[axis];
    const got = goods.wearChars[axis];
    if (wanted.length > 0 && got !== undefined && wanted.includes(got)) {
      s += WEIGHTS.wear;
    }
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run features/search/domain/score-row.test.ts`
Expected: PASS (기존 + 신규 2).

- [ ] **Step 5: Commit**

```bash
git add features/search/domain/score-row.ts features/search/domain/score-row.test.ts
git commit -m "feat: 착용감(wear_chars) 매칭을 소프트 스코어에 반영

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: LLM 파서 — wear_chars 어휘 주입·검증

**Files:**
- Modify: `features/search/data/parse-query-intent.ts`
- Test: `features/search/data/parse-query-intent.test.ts` (add sanitize cases)

**Interfaces:**
- Consumes: `WEAR_CHARS_VOCAB`(Task 2), `WEAR_AXES`·`WearCharsFilter`(Task 1).
- Produces: LLM 출력의 `wearChars`를 축별 유효값만 남겨 `QueryIntent.wearChars`에 채움. 프롬프트에 축별 유효값 목록 + 짧은 지시(매핑표 없음) + 예시 주입.

- [ ] **Step 1: Write the failing test**

`features/search/data/parse-query-intent.test.ts`의 기존 `describe("parseQueryIntent", ...)` **안에 `it`만 추가**. 파일 상단의 `llm` 헬퍼·`vi`·`parseQueryIntent` import를 재사용한다(중복 선언 금지). LLM 응답을 고정해 sanitize 경로를 검증:

```ts
  it("유효 착용감값은 유지, 목록 밖 값·축은 드롭", async () => {
    vi.stubEnv("NVIDIA_API_KEY", "k");
    const content = JSON.stringify({
      gender: null, sizeStd: [], priceMin: null, priceMax: null,
      style: { colors: [], patterns: [], materials: [], fits: [], keywords: [] },
      promote: [], exclude: { colors: [], patterns: [], materials: [], fits: [], keywords: [] },
      wearChars: { 촉감: ["부드러움", "쫀득함"], 두께: ["얇음"], 몸무게: ["70"] },
      sort: "relevance",
    });
    const r = await parseQueryIntent("부드부드한 반팔", vi.fn().mockResolvedValue(llm(content)));
    expect(r.intent.wearChars.촉감).toEqual(["부드러움"]); // "쫀득함" 드롭
    expect(r.intent.wearChars.두께).toEqual(["얇음"]);
    expect(r.intent.wearChars.비침).toEqual([]); // 미지정 축
    expect(r.intent.wearChars).not.toHaveProperty("몸무게"); // 축 밖 키 무시
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run features/search/data/parse-query-intent.test.ts`
Expected: FAIL — `intent.wearChars` undefined.

- [ ] **Step 3: Implement**

`features/search/data/parse-query-intent.ts`:

import에 추가:

```ts
import { WEAR_CHARS_VOCAB } from "@/features/search/data/wear-chars-vocab";
import {
  EMPTY_INTENT,
  type QueryIntent,
  type SortIntent,
  type StyleFilter,
  WEAR_AXES,
  type WearCharsFilter,
} from "@/features/search/domain/query-intent";
```

`ParsedRaw` 인터페이스에 `wearChars?: unknown;` 추가.

`keepWear` 헬퍼 추가(‑ `styleOf` 근처):

```ts
function keepWear(raw: unknown): WearCharsFilter {
  const r: Record<string, unknown> =
    typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  const out = {} as WearCharsFilter;
  for (const axis of WEAR_AXES) {
    out[axis] = keepEnum(r[axis], WEAR_CHARS_VOCAB[axis]);
  }
  return out;
}
```

`sanitize` 반환 객체에 추가(‑ `exclude` 아래):

```ts
    exclude: styleOf(raw.exclude),
    wearChars: keepWear(raw.wearChars),
    sort,
  };
```

프롬프트(`SYSTEM_PROMPT`) 갱신 — 스키마의 `"exclude"` 블록 다음 줄에 필드 추가:

```
  "wearChars": {                // 착용감. 각 배열은 아래 목록에서만. 없으면 []. 사용자가 촉감·두께·비침·신축성·계절·핏을 말할 때만.
    "촉감": string[], "두께": string[], "비침": string[], "신축성": string[], "계절": string[], "핏": string[]
  },
```

통제 어휘 블록(‑ `fits:` 줄 아래)에 추가:

```
- wearChars.촉감: ${WEAR_CHARS_VOCAB["촉감"].join(", ")}
- wearChars.두께: ${WEAR_CHARS_VOCAB["두께"].join(", ")}
- wearChars.비침: ${WEAR_CHARS_VOCAB["비침"].join(", ")}
- wearChars.신축성: ${WEAR_CHARS_VOCAB["신축성"].join(", ")}
- wearChars.계절: ${WEAR_CHARS_VOCAB["계절"].join(", ")}
- wearChars.핏: ${WEAR_CHARS_VOCAB["핏"].join(", ")}
```

규칙 블록에 한 줄 추가(매핑표가 아니라 위임 지시):

```
- wearChars: 사용자의 착용감 표현(부드러운·시원한·도톰한·쫀쫀한·비침없는 등)을 위 목록 값으로 매핑. 정도를 아우르면 인접값도 함께(예 "부드러운"→촉감:["부드러움","약간|부드러움"]). 값은 목록과 정확히 일치시키고 목록 밖은 쓰지 마라. 언급 없으면 전부 [].
```

예시 하나 추가(‑ 마지막 예시 뒤, 백틱 닫기 전):

```
입력: "부드부드하고 시원한 반팔"
출력: {"gender":null,"sizeStd":[],"priceMin":null,"priceMax":null,"style":{"colors":[],"patterns":[],"materials":[],"fits":[],"keywords":[]},"promote":[],"exclude":{"colors":[],"patterns":[],"materials":[],"fits":[],"keywords":[]},"wearChars":{"촉감":["부드러움","약간|부드러움"],"두께":["얇음","약간 얇음"],"비침":["없음","거의 없음"],"신축성":[],"계절":["여름"],"핏":[]},"sort":"relevance"}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run features/search/data/parse-query-intent.test.ts`
Expected: PASS (기존 + 신규).

- [ ] **Step 5: Commit**

```bash
git add features/search/data/parse-query-intent.ts features/search/data/parse-query-intent.test.ts
git commit -m "feat: 파서에 wear_chars 어휘 주입·검증 추가

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: 통합 검증 (전체 테스트·품질 게이트·실쿼리 스모크)

**Files:**
- (코드 변경 없음 예상) `app/api/search/route.ts`는 `select("*")`로 `wear_chars`를 이미 가져오고, `mapGoodsRow`→`rankGoods`→`styleScore`가 새 축을 자동 반영한다. 응답 `intent`에도 `wearChars`가 자동 포함된다. 배선 누락이 발견되면 이 태스크에서 최소 수정.

**Interfaces:**
- Consumes: Task 1~5 전부.

- [ ] **Step 1: 전체 유닛 테스트**

Run: `npm test`
Expected: 전 테스트 PASS(회귀 없음). 실패 시 해당 태스크로 돌아가 수정.

- [ ] **Step 2: 품질 게이트**

Run: `npm run check`
Expected: lint·typecheck·format 전부 통과. `wearChars` 미배선으로 타입 에러가 나면 `route.ts`의 payload 타입(`SearchPayload`)이 `QueryIntent`를 쓰는지 확인(이미 씀 → 자동). format 어긋나면 `npm run format` 후 재확인.

- [ ] **Step 3: 실쿼리 스모크(수동)**

`.env.local`에 NVIDIA/Supabase 키가 있는 상태에서:

```bash
npm run dev
# 다른 터미널:
curl -s -X POST http://localhost:3000/api/search \
  -H 'Content-Type: application/json' \
  -d '{"query":"부드럽고 시원한 반팔"}' | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);console.log('wearChars:',JSON.stringify(j.intent.wearChars));console.log('결과수:',j.results.length,'| top3:',j.results.slice(0,3).map(r=>r.title));})"
```

Expected: `intent.wearChars.촉감`에 `부드러움`류가, `두께/비침/계절`에 시원함 관련값이 채워지고, 결과가 반환됨(소프트 축이라 0건 아님). 채워지지 않으면 프롬프트(Task 5)·모델 확인.

- [ ] **Step 4: Commit (변경이 있었다면)**

```bash
git add -A
git commit -m "test: wear_chars 검색 통합 검증 및 배선 정리

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## 완료 후 (범위 밖 — 다음 단계)

- **Phase 2 UI**: 의도칩에 `wearChars` 축 노출·조건제거, 상세 착용감 표시 → [Phase 2 스펙](../specs/2026-07-30-musinsa-ui-phase2-design.md) §9 반영.
- **Phase 1.5b (백로그)**: 검증 쿼리 DSL 엔진·소프트 필터링·progressive relaxation·퍼지 스냅(목록 밖 근사매칭)·`title~`→FTS.
