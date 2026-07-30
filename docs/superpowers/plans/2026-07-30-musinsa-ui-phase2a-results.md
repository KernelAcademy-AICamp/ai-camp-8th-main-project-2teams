# Phase 2a — 검색 결과 화면 무신사 소비 전환 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 검색 결과 화면(데이터·뷰모델·칩·카드·애널리틱스)을 옛 네이버 `Tee`/`Intent`에서 무신사 `Goods`/`QueryIntent`로 전환해, 서버가 이미 반환하는 무신사 결과가 화면에 올바로 뜨게 한다.

**Architecture:** 서버 `/api/search`는 이미 `{ results: Goods[], intent: QueryIntent, degraded }`를 반환한다(Phase 1 컷오버 완료). 현재 클라는 이를 `Tee[]`/`Intent`로 캐스팅만 해 제목·색·핏이 안 뜨고 상세 링크가 `/tee/undefined`로 깨진다. 이 플랜은 클라 소비층을 재작성한다. **결과 화면 소비층(analytics·search-remote·viewmodel·ResultList·IntentChips·SearchResults)은 한 계약으로 강결합**돼 있어 원자적으로 전환한다(Task 3). 칩 편집 재검색은 서버 왕복 없이 반환 후보를 `rankGoods`로 클라 재랭크한다. 네이버 폴백은 제거한다. **범위는 결과 화면만** — 상세(`/goods/[goodsNo]`)·네이버 코드 삭제·포지셔닝 카피는 2b/2c.

**Tech Stack:** Next.js(App Router, `"use client"`, React Compiler 린트) · vitest · GA(track).

## Global Constraints

- 데이터 계약은 서버가 확정한 `Goods`(`features/catalog/domain/goods.ts`)·`QueryIntent`(`features/search/domain/query-intent.ts`). 클라는 **그대로 소비**(재해석/어댑터 금지).
- 결과는 **단일 `Goods[]`**(랭킹 top-N). exact/partial 분리 없음.
- 칩은 **텍스트 전용**(색 hex 스와치 없음). 카드도 색/핏 뱃지 생략. 리뷰 0건이면 ⭐ 미노출.
- **네이버 폴백 제거**: `searchTees`·`parseQueryRemote`·`matchBrand`·`getBrands`·`supabaseTeeRepository` 미사용. degraded/에러 → 빈 결과 + "다시 시도". 빈 쿼리 → 빈 상태(전체 덤프 금지).
- 칩 제거 재검색 = 반환 후보 `Goods[]`를 `rankGoods(candidates, nextIntent, 60)`로 클라 재랭크(백엔드 무변경).
- **범위 밖(삭제 금지)**: 옛 네이버 파일(`tee.ts`·`intent.ts`·`intent-chips.ts`(옛)·`remove-constraint.ts`(옛)·`reconcile-working-intent.ts`(옛)·`search-tees.ts`·`parse-query-remote.ts`·`match-brand.ts`·tee 리포지토리·`TeeSwatch`·`app/api/parse`·`/tee/[id]`·product-detail)은 이 플랜에서 **삭제하지 않는다**(2c). 검색 경로에서 참조만 끊는다. 이들의 기존 테스트는 계속 통과해야 한다.
- **원자적 커밋 규칙**: 모든 커밋은 그 시점 `npm run typecheck`가 green이어야 한다. Task 1·2는 추가형이라 green. Task 3은 강결합 6파일을 **한 커밋**으로 전환해 green을 유지한다(중간에 쪼개 red 커밋을 만들지 말 것).
- React Compiler 린트: effect 안 setState 금지(렌더 중 조정 패턴), 렌더 중 ref 쓰기 금지.
- 완료 게이트: `npm run check`(lint+typecheck+format:check) 그린.
- 커밋: 한글 Conventional Commits + 트레일러 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. 모든 경로는 `client/` 기준.
- Next.js 주의(저장소 AGENTS.md): "This is NOT the Next.js you know" — `next/image` remotePatterns 등 설정 전 `node_modules/next/dist/docs/`의 현재 버전 문서를 확인.

---

### Task 1: 무신사 의도칩 타입 + `queryIntentToChips` (도메인, 추가형)

**Files:**
- Create: `features/search/domain/query-intent-chips.ts`
- Test: `features/search/domain/query-intent-chips.test.ts` (create)

**Interfaces:**
- Consumes: `QueryIntent`·`StyleFilter`·`WearAxis`·`WEAR_AXES`(query-intent.ts).
- Produces: `type ChipKind`, `interface IntentChip { kind; label; value?; axis?; excludeField? }`, `queryIntentToChips(intent: QueryIntent): IntentChip[]`.

- [ ] **Step 1: Write the failing test**

```ts
// features/search/domain/query-intent-chips.test.ts
import { describe, expect, it } from "vitest";

import { EMPTY_INTENT, type QueryIntent } from "@/features/search/domain/query-intent";
import { type IntentChip, queryIntentToChips } from "@/features/search/domain/query-intent-chips";

function intent(p: Partial<QueryIntent>): QueryIntent {
  return { ...EMPTY_INTENT, ...p, style: { ...EMPTY_INTENT.style, ...(p.style ?? {}) } };
}
function labels(chips: IntentChip[]): string[] {
  return chips.map((c) => c.label);
}

describe("queryIntentToChips", () => {
  it("스타일 값마다 개별 칩(색·핏)", () => {
    const chips = queryIntentToChips(
      intent({ style: { colors: ["블랙", "화이트"], patterns: [], materials: [], fits: ["오버"], keywords: [] } }),
    );
    expect(labels(chips)).toEqual(expect.arrayContaining(["블랙", "화이트", "오버핏"]));
    expect(chips.find((c) => c.label === "블랙")).toMatchObject({ kind: "color", value: "블랙" });
  });

  it("착용감은 축:값 라벨 + axis 보존", () => {
    const chips = queryIntentToChips(intent({ wearChars: { ...EMPTY_INTENT.wearChars, 촉감: ["부드러움"] } }));
    expect(chips).toContainEqual(
      expect.objectContaining({ kind: "wear", axis: "촉감", value: "부드러움", label: "촉감:부드러움" }),
    );
  });

  it("성별·사이즈·가격은 전체 제거 칩(value 없음)", () => {
    const chips = queryIntentToChips(intent({ gender: "여성", sizeStd: [90, 95], priceMax: 30000 }));
    expect(chips.find((c) => c.kind === "gender")?.label).toBe("여성");
    expect(chips.find((c) => c.kind === "size")?.label).toBe("사이즈 90·95");
    expect(chips.find((c) => c.kind === "price")?.label).toBe("3만원 이하");
  });

  it("exclude 값은 '제외' 칩 + excludeField 보존", () => {
    const chips = queryIntentToChips(
      intent({ exclude: { colors: ["레드"], patterns: [], materials: [], fits: [], keywords: [] } }),
    );
    expect(chips).toContainEqual(
      expect.objectContaining({ kind: "exclude", excludeField: "colors", value: "레드", label: "레드 제외" }),
    );
  });

  it("빈 intent는 빈 배열", () => {
    expect(queryIntentToChips(EMPTY_INTENT)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run features/search/domain/query-intent-chips.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// features/search/domain/query-intent-chips.ts
// 유스케이스: QueryIntent → 의도칩. 순수 함수. "AI가 이해한 조건" 증명 + 조건 제거 단위.
import {
  type QueryIntent,
  type StyleFilter,
  WEAR_AXES,
  type WearAxis,
} from "@/features/search/domain/query-intent";

export type ChipKind =
  | "gender" | "size" | "price"
  | "color" | "pattern" | "material" | "fit" | "keyword"
  | "wear" | "exclude";

export interface IntentChip {
  kind: ChipKind;
  label: string;
  value?: string; // 개별 값 제거용. 없으면 해당 축 전체 제거(성별·사이즈·가격).
  axis?: WearAxis; // kind "wear" 전용
  excludeField?: keyof StyleFilter; // kind "exclude" 전용
}

const STYLE_KINDS: { field: keyof StyleFilter; kind: ChipKind; suffix?: string }[] = [
  { field: "colors", kind: "color" },
  { field: "patterns", kind: "pattern" },
  { field: "materials", kind: "material" },
  { field: "fits", kind: "fit", suffix: "핏" },
  { field: "keywords", kind: "keyword" },
];

function priceLabel(min?: number, max?: number): string | null {
  const man = (n: number): string => `${Math.round(n / 10000)}만원`;
  if (min != null && max != null) return `${man(min)}~${man(max)}`;
  if (max != null) return `${man(max)} 이하`;
  if (min != null) return `${man(min)} 이상`;
  return null;
}

export function queryIntentToChips(intent: QueryIntent): IntentChip[] {
  const chips: IntentChip[] = [];

  if (intent.gender) chips.push({ kind: "gender", label: intent.gender });
  if (intent.sizeStd.length > 0) chips.push({ kind: "size", label: `사이즈 ${intent.sizeStd.join("·")}` });
  const price = priceLabel(intent.priceMin, intent.priceMax);
  if (price) chips.push({ kind: "price", label: price });

  for (const { field, kind, suffix } of STYLE_KINDS) {
    for (const value of intent.style[field]) {
      chips.push({ kind, label: suffix ? `${value}${suffix}` : value, value });
    }
  }
  for (const axis of WEAR_AXES) {
    for (const value of intent.wearChars[axis]) {
      chips.push({ kind: "wear", axis, value, label: `${axis}:${value}` });
    }
  }
  for (const { field } of STYLE_KINDS) {
    for (const value of intent.exclude[field]) {
      chips.push({ kind: "exclude", excludeField: field, value, label: `${value} 제외` });
    }
  }
  return chips;
}
```

- [ ] **Step 4: 테스트 + 타입 게이트**

Run: `npx vitest run features/search/domain/query-intent-chips.test.ts` → PASS.
Run: `npm run typecheck` → 통과(추가형이라 프로젝트 green 유지).

- [ ] **Step 5: Commit**

```bash
git add features/search/domain/query-intent-chips.ts features/search/domain/query-intent-chips.test.ts
git commit -m "feat: 무신사 의도칩 타입·queryIntentToChips 추가

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: 조건 제거·작업의도 조정 (QueryIntent 도메인, 추가형)

**Files:**
- Create: `features/search/domain/remove-query-constraint.ts`
- Create: `features/search/domain/reconcile-query-intent.ts`
- Test: `features/search/domain/remove-query-constraint.test.ts` (create)

**Interfaces:**
- Consumes: `QueryIntent`·`StyleFilter`(query-intent.ts), `IntentChip`(Task 1).
- Produces: `removeConstraint(intent: QueryIntent, chip: IntentChip): QueryIntent`, `reconcileWorkingIntent(parsed, prevParsed, working): QueryIntent`.

*(옛 `remove-constraint.ts`/`reconcile-working-intent.ts`는 Tee `Intent`용 — 그대로 두고 새 파일 생성. 2c에서 옛 파일 삭제.)*

- [ ] **Step 1: Write the failing test**

```ts
// features/search/domain/remove-query-constraint.test.ts
import { describe, expect, it } from "vitest";

import { EMPTY_INTENT, type QueryIntent } from "@/features/search/domain/query-intent";
import { removeConstraint } from "@/features/search/domain/remove-query-constraint";

function intent(p: Partial<QueryIntent>): QueryIntent {
  return { ...EMPTY_INTENT, ...p, style: { ...EMPTY_INTENT.style, ...(p.style ?? {}) } };
}

describe("removeConstraint", () => {
  it("색 값 하나만 제거(나머지 유지)", () => {
    const before = intent({ style: { colors: ["블랙", "화이트"], patterns: [], materials: [], fits: [], keywords: [] } });
    expect(removeConstraint(before, { kind: "color", label: "블랙", value: "블랙" }).style.colors).toEqual(["화이트"]);
  });
  it("착용감 값 제거(axis 기준)", () => {
    const before = intent({ wearChars: { ...EMPTY_INTENT.wearChars, 촉감: ["부드러움", "보통"] } });
    expect(
      removeConstraint(before, { kind: "wear", axis: "촉감", value: "부드러움", label: "촉감:부드러움" }).wearChars.촉감,
    ).toEqual(["보통"]);
  });
  it("성별·사이즈·가격은 전체 제거", () => {
    const before = intent({ gender: "여성", sizeStd: [90], priceMin: 10000, priceMax: 30000 });
    expect(removeConstraint(before, { kind: "gender", label: "여성" }).gender).toBeUndefined();
    expect(removeConstraint(before, { kind: "size", label: "사이즈 90" }).sizeStd).toEqual([]);
    const noPrice = removeConstraint(before, { kind: "price", label: "1만원~3만원" });
    expect(noPrice.priceMin).toBeUndefined();
    expect(noPrice.priceMax).toBeUndefined();
  });
  it("exclude 값 제거", () => {
    const before = intent({ exclude: { colors: ["레드"], patterns: [], materials: [], fits: [], keywords: [] } });
    expect(
      removeConstraint(before, { kind: "exclude", excludeField: "colors", value: "레드", label: "레드 제외" }).exclude.colors,
    ).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run features/search/domain/remove-query-constraint.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
// features/search/domain/remove-query-constraint.ts
// 유스케이스: 의도칩 하나를 QueryIntent에서 제거. 순수 함수(불변).
import type { QueryIntent, StyleFilter } from "@/features/search/domain/query-intent";
import type { IntentChip } from "@/features/search/domain/query-intent-chips";

const KIND_TO_FIELD: Partial<Record<IntentChip["kind"], keyof StyleFilter>> = {
  color: "colors", pattern: "patterns", material: "materials", fit: "fits", keyword: "keywords",
};

function without(arr: string[], value?: string): string[] {
  return value === undefined ? arr : arr.filter((v) => v !== value);
}

export function removeConstraint(intent: QueryIntent, chip: IntentChip): QueryIntent {
  switch (chip.kind) {
    case "gender":
      return { ...intent, gender: undefined };
    case "size":
      return { ...intent, sizeStd: [] };
    case "price":
      return { ...intent, priceMin: undefined, priceMax: undefined };
    case "wear":
      if (!chip.axis) return intent;
      return { ...intent, wearChars: { ...intent.wearChars, [chip.axis]: without(intent.wearChars[chip.axis], chip.value) } };
    case "exclude":
      if (!chip.excludeField) return intent;
      return { ...intent, exclude: { ...intent.exclude, [chip.excludeField]: without(intent.exclude[chip.excludeField], chip.value) } };
    default: {
      const field = KIND_TO_FIELD[chip.kind];
      if (!field) return intent;
      return { ...intent, style: { ...intent.style, [field]: without(intent.style[field], chip.value) } };
    }
  }
}
```

```ts
// features/search/domain/reconcile-query-intent.ts
// 유스케이스: 이번 렌더에 쓸 "작업 의도" 선택. 새 파싱 도착 프레임엔 parsed.intent를 써 desync(전체 튐) 방지.
import type { QueryIntent } from "@/features/search/domain/query-intent";

interface Parsed {
  intent: QueryIntent;
}

export function reconcileWorkingIntent(parsed: Parsed, prevParsed: Parsed, workingIntent: QueryIntent): QueryIntent {
  return parsed !== prevParsed ? parsed.intent : workingIntent;
}
```

- [ ] **Step 4: 테스트 + 타입 게이트**

Run: `npx vitest run features/search/domain/remove-query-constraint.test.ts` → PASS.
Run: `npm run typecheck` → 통과(추가형).

- [ ] **Step 5: Commit**

```bash
git add features/search/domain/remove-query-constraint.ts features/search/domain/reconcile-query-intent.ts \
  features/search/domain/remove-query-constraint.test.ts
git commit -m "feat: QueryIntent 조건 제거·작업의도 조정 유스케이스 추가

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: 결과 화면 원자적 컷오버 (analytics·search-remote·viewmodel·컴포넌트)

> **원자적**: 이 6파일은 서로의 타입에 강결합돼 있다. **한 커밋**으로 전환해 프로젝트 `tsc`를 green으로 유지한다. 부분 커밋(중간 red) 금지. 큰 태스크지만 코드는 아래 전부 제공된다.

**Files:**
- Modify: `shared/analytics-params.ts` (+ `shared/analytics-params.test.ts` 재작성)
- Modify: `features/search/data/search-remote.ts` (+ `features/search/data/search-remote.test.ts` 재작성)
- Modify: `features/search/presentation/view-model/use-search-view-model.ts` (+ `...test.ts` 신규)
- Modify: `features/search/presentation/components/ResultList.tsx`
- Modify: `features/search/presentation/components/IntentChips.tsx`
- Modify: `features/search/presentation/components/SearchResults.tsx`
- Possibly Modify: `next.config.*` (무신사 이미지 호스트)

**Interfaces (this task produces):**
- `analytics-params`: `type ResultType = "results" | "none"`, `deriveResultType(results: Goods[]): ResultType`, `flattenParsedAttributes(intent: QueryIntent): Record<string,string>`, `hasParsedConstraint(intent): boolean`, `entryTypeFromSrc`(그대로).
- `searchRemote(query: string, fetchFn?: typeof fetch): Promise<{ results: Goods[]; intent: QueryIntent; degraded: boolean }>`.
- `useSearchViewModel(query, src): { loading; chips: IntentChip[]; results: Goods[]; removeConstraint; searchId; resultType }`.
- `ResultList({ goods: Goods[]; searchId; resultType })`, `IntentChips({ chips: IntentChip[]; onRemove? })`.

- [ ] **Step 1: Write/rewrite the failing tests (3 test files)**

`shared/analytics-params.test.ts` 전체 교체:

```ts
import { describe, expect, it } from "vitest";

import type { Goods } from "@/features/catalog/domain/goods";
import { EMPTY_INTENT, type QueryIntent } from "@/features/search/domain/query-intent";
import {
  deriveResultType, entryTypeFromSrc, flattenParsedAttributes, hasParsedConstraint,
} from "@/shared/analytics-params";

function intent(p: Partial<QueryIntent>): QueryIntent {
  return { ...EMPTY_INTENT, ...p, style: { ...EMPTY_INTENT.style, ...(p.style ?? {}) } };
}

describe("deriveResultType", () => {
  it("결과 유무로 results/none", () => {
    expect(deriveResultType([])).toBe("none");
    expect(deriveResultType([{ goodsNo: "1" } as Goods])).toBe("results");
  });
});
describe("flattenParsedAttributes", () => {
  it("QueryIntent 필드를 GA 평면 파라미터로", () => {
    const out = flattenParsedAttributes(intent({
      gender: "여성", priceMax: 30000,
      style: { colors: ["블랙"], patterns: [], materials: ["면"], fits: ["오버"], keywords: [] },
      wearChars: { ...EMPTY_INTENT.wearChars, 촉감: ["부드러움"] },
    }));
    expect(out).toMatchObject({
      parsed_gender: "여성", parsed_colors: "블랙", parsed_materials: "면",
      parsed_fits: "오버", parsed_wear: "촉감:부드러움", parsed_price_max: "30000",
    });
  });
  it("빈 intent는 빈 객체", () => {
    expect(flattenParsedAttributes(EMPTY_INTENT)).toEqual({});
  });
});
describe("hasParsedConstraint", () => {
  it("제약 유무", () => {
    expect(hasParsedConstraint(intent({ gender: "여성" }))).toBe(true);
    expect(hasParsedConstraint(EMPTY_INTENT)).toBe(false);
  });
});
describe("entryTypeFromSrc", () => {
  it("src 매핑", () => {
    expect(entryTypeFromSrc("typed")).toBe("typed");
    expect(entryTypeFromSrc("chip")).toBe("example_chip");
    expect(entryTypeFromSrc(null)).toBe("direct");
  });
});
```

`features/search/data/search-remote.test.ts` 전체 교체:

```ts
import { describe, expect, it, vi } from "vitest";

import type { Goods } from "@/features/catalog/domain/goods";
import { EMPTY_INTENT } from "@/features/search/domain/query-intent";
import { searchRemote } from "@/features/search/data/search-remote";

function res(body: unknown, ok = true): Response {
  return { ok, json: () => Promise.resolve(body) } as unknown as Response;
}
const goods = [{ goodsNo: "1", title: "블랙 반팔" } as Goods];

describe("searchRemote", () => {
  it("빈 쿼리는 서버 호출 없이 빈 결과", async () => {
    const fetchMock = vi.fn();
    const r = await searchRemote("  ", fetchMock as unknown as typeof fetch);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(r).toEqual({ results: [], intent: EMPTY_INTENT, degraded: false });
  });
  it("성공 응답을 그대로 반환", async () => {
    const fetchMock = vi.fn().mockResolvedValue(res({ results: goods, intent: EMPTY_INTENT, degraded: false }));
    const r = await searchRemote("블랙 반팔", fetchMock as unknown as typeof fetch);
    expect(r.results).toEqual(goods);
    expect(r.degraded).toBe(false);
  });
  it("degraded 응답은 빈 결과로 강등(폴백 없음)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(res({ results: [], intent: EMPTY_INTENT, degraded: true }));
    expect((await searchRemote("x", fetchMock as unknown as typeof fetch)).degraded).toBe(true);
  });
  it("네트워크 오류는 degraded 빈 결과", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("net"));
    expect(await searchRemote("x", fetchMock as unknown as typeof fetch)).toEqual({
      results: [], intent: EMPTY_INTENT, degraded: true,
    });
  });
});
```

`features/search/presentation/view-model/use-search-view-model.test.ts` 신규(칩 제거 재랭크 조합 가드):

```ts
import { describe, expect, it } from "vitest";

import type { Goods } from "@/features/catalog/domain/goods";
import { EMPTY_INTENT, type QueryIntent } from "@/features/search/domain/query-intent";
import { rankGoods } from "@/features/search/domain/rank-goods";
import { removeConstraint } from "@/features/search/domain/remove-query-constraint";

function goods(p: Partial<Goods> & { goodsNo: string }): Goods {
  return {
    styleKey: "", title: "티", brand: "", category: "", gender: "", colors: [], patterns: [],
    materials: [], fits: [], sizes: [], sizeFree: false, sizeStd: [], price: 0, reviewCount: 0,
    reviewScore: 0, gallery: [], url: "", thumbnail: "", wearChars: {}, ...p,
  };
}
function intent(p: Partial<QueryIntent>): QueryIntent {
  return { ...EMPTY_INTENT, ...p, style: { ...EMPTY_INTENT.style, ...(p.style ?? {}) } };
}

describe("칩 제거 재랭크(뷰모델 조합)", () => {
  it("색 칩 제거 후 rankGoods는 후보를 배제하지 않는다(소프트 재랭크)", () => {
    const candidates = [goods({ goodsNo: "a", colors: ["블랙"] }), goods({ goodsNo: "b" })];
    const before = intent({ style: { colors: ["블랙"], patterns: [], materials: [], fits: [], keywords: [] } });
    const next = removeConstraint(before, { kind: "color", label: "블랙", value: "블랙" });
    expect(rankGoods(candidates, next, 60)).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run shared/analytics-params.test.ts features/search/data/search-remote.test.ts`
Expected: FAIL — 옛 시그니처(`Intent`/`SearchResult`, `searchRemote(query, brands, tees)`)와 불일치.

- [ ] **Step 3: Implement all 6 files (single coherent change)**

(3a) `shared/analytics-params.ts` 전체 교체:

```ts
// 이벤트 파라미터 가공 — node 단위 테스트 가능한 순수 함수만(DOM/GA 접근 금지).
import type { Goods } from "@/features/catalog/domain/goods";
import { type QueryIntent, WEAR_AXES } from "@/features/search/domain/query-intent";

export type ResultType = "results" | "none";
export type EntryType = "typed" | "example_chip" | "direct";

export function deriveResultType(results: Goods[]): ResultType {
  return results.length > 0 ? "results" : "none";
}

export function flattenParsedAttributes(intent: QueryIntent): Record<string, string> {
  const out: Record<string, string> = {};
  const { style } = intent;
  if (style.colors.length) out.parsed_colors = style.colors.join(",");
  if (style.patterns.length) out.parsed_patterns = style.patterns.join(",");
  if (style.materials.length) out.parsed_materials = style.materials.join(",");
  if (style.fits.length) out.parsed_fits = style.fits.join(",");
  if (style.keywords.length) out.parsed_keywords = style.keywords.join(",");
  const wear = WEAR_AXES.flatMap((axis) => intent.wearChars[axis].map((v) => `${axis}:${v}`));
  if (wear.length) out.parsed_wear = wear.join(",");
  if (intent.gender) out.parsed_gender = intent.gender;
  if (intent.sizeStd.length) out.parsed_size_std = intent.sizeStd.join(",");
  if (intent.priceMin != null) out.parsed_price_min = String(intent.priceMin);
  if (intent.priceMax != null) out.parsed_price_max = String(intent.priceMax);
  return out;
}

export function hasParsedConstraint(intent: QueryIntent): boolean {
  return Object.keys(flattenParsedAttributes(intent)).length > 0;
}

export function entryTypeFromSrc(src: string | null): EntryType {
  if (src === "typed") return "typed";
  if (src === "chip") return "example_chip";
  return "direct";
}
```

(3b) `features/search/data/search-remote.ts` 전체 교체:

```ts
"use client";

// 데이터 접근: 자연어 쿼리 → /api/search(서버 무신사 구조화 검색).
// 폴백 없음 — degraded/오류 시 빈 결과 + degraded=true(화면에서 재시도 안내).
import type { Goods } from "@/features/catalog/domain/goods";
import { EMPTY_INTENT, type QueryIntent } from "@/features/search/domain/query-intent";

const SEARCH_TIMEOUT_MS = 9000;

export interface SearchOutcome {
  results: Goods[];
  intent: QueryIntent;
  degraded: boolean;
}

interface SearchApiResponse {
  results?: Goods[];
  intent?: QueryIntent;
  degraded?: boolean;
}

export async function searchRemote(query: string, fetchFn: typeof fetch = fetch): Promise<SearchOutcome> {
  if (!query.trim()) return { results: [], intent: EMPTY_INTENT, degraded: false };

  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, SEARCH_TIMEOUT_MS);
  try {
    const httpRes = await fetchFn("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
      signal: controller.signal,
    });
    if (!httpRes.ok) throw new Error(`search route ${String(httpRes.status)}`);
    const data = (await httpRes.json()) as SearchApiResponse;
    if (data.degraded || !Array.isArray(data.results)) {
      return { results: [], intent: data.intent ?? EMPTY_INTENT, degraded: true };
    }
    return { results: data.results, intent: data.intent ?? EMPTY_INTENT, degraded: false };
  } catch {
    return { results: [], intent: EMPTY_INTENT, degraded: true };
  } finally {
    clearTimeout(timer);
  }
}
```

(3c) `features/search/presentation/view-model/use-search-view-model.ts` 전체 교체:

```ts
"use client";

// ViewModel (MVVM) — 검색 결과 화면. query(=URL)로 로딩·의도칩·결과 계산.
// 서버 /api/search(무신사) 호출. 칩 편집 시 반환 후보를 rankGoods로 클라 재랭크.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Goods } from "@/features/catalog/domain/goods";
import { searchRemote } from "@/features/search/data/search-remote";
import { EMPTY_INTENT, type QueryIntent } from "@/features/search/domain/query-intent";
import { type IntentChip, queryIntentToChips } from "@/features/search/domain/query-intent-chips";
import { rankGoods } from "@/features/search/domain/rank-goods";
import { reconcileWorkingIntent } from "@/features/search/domain/reconcile-query-intent";
import { removeConstraint } from "@/features/search/domain/remove-query-constraint";
import { newSearchId, track } from "@/shared/analytics";
import {
  deriveResultType, entryTypeFromSrc, flattenParsedAttributes, hasParsedConstraint, type ResultType,
} from "@/shared/analytics-params";

export interface SearchViewModel {
  loading: boolean;
  chips: IntentChip[];
  results: Goods[];
  removeConstraint: (chip: IntentChip) => void;
  searchId: string;
  resultType: ResultType;
}

interface Parsed {
  query: string;
  intent: QueryIntent;
  results: Goods[];
}
const EMPTY_PARSED: Parsed = { query: "", intent: EMPTY_INTENT, results: [] };

export function useSearchViewModel(query: string, src: string | null): SearchViewModel {
  const searchIdRef = useRef("");
  const [searchId, setSearchId] = useState("");
  const [loadingSearch, setLoadingSearch] = useState(false);

  const [parsed, setParsed] = useState<Parsed>(EMPTY_PARSED);
  const [prevParsed, setPrevParsed] = useState(parsed);
  const [workingIntent, setWorkingIntent] = useState<QueryIntent>(EMPTY_INTENT);

  // 새 파싱 도착 시 편집 상태 초기화 — 렌더 중 조정(effect 안 setState 금지).
  if (parsed !== prevParsed) {
    setPrevParsed(parsed);
    setWorkingIntent(parsed.intent);
  }
  const currentIntent = reconcileWorkingIntent(parsed, prevParsed, workingIntent);

  const remove = useCallback(
    (chip: IntentChip) => {
      const next = removeConstraint(workingIntent, chip);
      const after = rankGoods(parsed.results, next, 60);
      track("constraint_removed", {
        search_id: searchIdRef.current,
        attribute: chip.kind,
        after_result_count: after.length,
        after_result_type: deriveResultType(after),
      });
      setWorkingIntent(next);
    },
    [workingIntent, parsed],
  );

  useEffect(() => {
    let active = true;
    if (!query.trim()) {
      setParsed(EMPTY_PARSED);
      return;
    }
    const id = newSearchId();
    searchIdRef.current = id;
    setLoadingSearch(true);
    const startedAt = performance.now();
    void searchRemote(query).then(({ results, intent, degraded }) => {
      if (!active) return;
      setParsed({ query, intent, results });
      setSearchId(id);
      setLoadingSearch(false);
      track("search_performed", {
        search_id: id,
        query,
        result_count: results.length,
        result_type: deriveResultType(results),
        degraded,
        understood: hasParsedConstraint(intent),
        entry_type: entryTypeFromSrc(src),
        is_refinement: src === "refine",
        duration_ms: Math.round(performance.now() - startedAt),
        ...flattenParsedAttributes(intent),
      });
    });
    return () => {
      active = false;
    };
  }, [query, src]);

  const hasQuery = query.trim().length > 0;
  const parsing = hasQuery && parsed.query !== query;

  const chips = useMemo<IntentChip[]>(
    () => (hasQuery && !parsing ? queryIntentToChips(currentIntent) : []),
    [hasQuery, parsing, currentIntent],
  );

  const results = useMemo<Goods[]>(() => {
    if (!hasQuery || parsing) return [];
    return currentIntent === parsed.intent ? parsed.results : rankGoods(parsed.results, currentIntent, 60);
  }, [hasQuery, parsing, parsed, currentIntent]);

  const resultType = useMemo(() => deriveResultType(results), [results]);

  return {
    loading: parsing || loadingSearch,
    chips,
    results,
    removeConstraint: remove,
    searchId,
    resultType,
  };
}
```

(3d) `features/search/presentation/components/ResultList.tsx` 전체 교체:

```tsx
// View: 이미지 중심 결과 카드 — 썸네일 + 브랜드 + 제목 + 가격 + ⭐리뷰. 클릭 시 상세로.
import Image from "next/image";
import Link from "next/link";

import type { Goods } from "@/features/catalog/domain/goods";
import { track } from "@/shared/analytics";
import type { ResultType } from "@/shared/analytics-params";

export default function ResultList({
  goods, searchId, resultType,
}: {
  goods: Goods[];
  searchId: string;
  resultType: ResultType;
}) {
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {goods.map((item, rank) => (
        <li key={item.goodsNo}>
          <Link
            href={`/goods/${item.goodsNo}?sid=${encodeURIComponent(searchId)}&rank=${rank}&rt=${resultType}`}
            onClick={() => {
              track("result_clicked", {
                search_id: searchId, product_id: item.goodsNo, rank, result_type: resultType,
              });
            }}
            className="group block overflow-hidden rounded-2xl border border-line bg-wall transition hover:shadow-md"
          >
            <div className="relative aspect-square overflow-hidden bg-chalk">
              {item.thumbnail && (
                <Image src={item.thumbnail} alt={item.title} fill sizes="(max-width: 640px) 50vw, 25vw"
                  className="object-cover transition group-hover:scale-105" />
              )}
            </div>
            <div className="p-3">
              <p className="truncate font-mono text-[11px] uppercase tracking-wide text-ink-soft">{item.brand}</p>
              <h3 className="mt-0.5 line-clamp-2 min-h-[2.5em] font-sans text-[14px] font-semibold text-ink">{item.title}</h3>
              <div className="mt-1.5 flex items-center justify-between">
                <span className="font-display text-[15px] font-bold text-ink">
                  {item.price.toLocaleString()}
                  <span className="text-[11px] font-medium text-ink-soft">원</span>
                </span>
                {item.reviewCount > 0 && (
                  <span className="font-mono text-[11px] text-ink-soft">★ {item.reviewScore.toFixed(1)} ({item.reviewCount})</span>
                )}
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
```

(3e) `features/search/presentation/components/IntentChips.tsx` 전체 교체:

```tsx
// View: LLM이 "이해한 조건"을 텍스트 칩으로. onRemove가 있으면 × 삭제 버튼.
import type { IntentChip } from "@/features/search/domain/query-intent-chips";

export default function IntentChips({
  chips, onRemove,
}: {
  chips: IntentChip[];
  onRemove?: (chip: IntentChip) => void;
}) {
  if (chips.length === 0) {
    return (
      <p className="font-mono text-[12px] text-ink-soft">
        조건을 못 알아들었어요. 색·핏·소재·사이즈·가격을 넣어 다시 적어보세요.
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 font-mono text-[12px] uppercase tracking-wide text-ink-soft">이해한 조건 ▸</span>
      {chips.map((c, i) => (
        <span key={i} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-wall px-3 py-1 text-[13px] font-medium text-ink shadow-sm">
          {c.label}
          {onRemove && (
            <button type="button" onClick={() => { onRemove(c); }} aria-label={`${c.label} 조건 제거`}
              className="-mr-1 ml-0.5 grid size-4 place-items-center rounded-full text-ink-soft transition hover:bg-line hover:text-ink">
              ×
            </button>
          )}
        </span>
      ))}
    </div>
  );
}
```

(3f) `features/search/presentation/components/SearchResults.tsx` 전체 교체:

```tsx
"use client";

// 페이지 2 본체 — URL의 q를 읽어 무신사 검색. 이미지 카드 그리드로 표시.
import { useRouter, useSearchParams } from "next/navigation";

import AppHeader from "@/components/AppHeader";

import { useSearchViewModel } from "../view-model/use-search-view-model";
import IntentChips from "./IntentChips";
import ResultList from "./ResultList";
import SearchBar from "./SearchBar";

export default function SearchResults() {
  const router = useRouter();
  const params = useSearchParams();
  const query = params.get("q") ?? "";
  const vm = useSearchViewModel(query, params.get("src"));
  const go = (q: string, src = "refine") => {
    router.push(`/search?q=${encodeURIComponent(q)}&src=${src}`);
  };

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-6">
        <SearchBar initialValue={query} onSearch={go} />

        {query && !vm.loading && (
          <div className="rise mt-5">
            <IntentChips chips={vm.chips} onRemove={vm.removeConstraint} />
          </div>
        )}

        {(() => {
          if (vm.loading) {
            return (
              <div className="mt-6 grid place-items-center rounded-2xl border border-dashed border-line py-16 text-center">
                <p className="font-display text-lg font-bold text-ink">검색 중…</p>
                <p className="mt-1 text-[13px] text-ink-soft">조건을 분석하고 있어요.</p>
              </div>
            );
          }
          if (!query) {
            return (
              <div className="mt-6 grid place-items-center rounded-2xl border border-dashed border-line py-16 text-center">
                <p className="font-display text-lg font-bold text-ink">말로 찾아보세요</p>
                <p className="mt-1 max-w-xs text-[13px] text-ink-soft">색·핏·소재·사이즈·가격을 한 문장으로.</p>
              </div>
            );
          }
          if (vm.results.length === 0) {
            return (
              <div className="mt-6 grid place-items-center rounded-2xl border border-dashed border-line py-16 text-center">
                <p className="font-display text-lg font-bold text-ink">결과가 없어요</p>
                <p className="mt-1 max-w-xs text-[13px] text-ink-soft">조건을 조금 줄이거나 다시 검색해 보세요.</p>
              </div>
            );
          }
          return (
            <>
              <div className="mb-3 mt-6 flex items-baseline justify-between">
                <h2 className="font-display text-lg font-bold text-ink">검색 결과</h2>
                <span className="font-mono text-[12px] text-ink-soft">{vm.results.length}개</span>
              </div>
              <ResultList goods={vm.results} searchId={vm.searchId} resultType={vm.resultType} />
            </>
          );
        })()}
      </main>
      <footer className="border-t border-line px-5 py-6">
        <p className="mx-auto max-w-5xl font-mono text-[11px] text-ink-soft">무신사 상품 · 자연어 발견 검색</p>
      </footer>
    </div>
  );
}
```

(3g) 무신사 이미지 호스트: `grep -n "msscdn\|remotePatterns" next.config.*` 로 확인. 없으면 `images.remotePatterns`에 `{ protocol: "https", hostname: "image.msscdn.net" }` 추가(먼저 `node_modules/next/dist/docs/`의 이미지 설정 문서 확인).

- [ ] **Step 4: Run tests + full gate**

Run: `npx vitest run shared/analytics-params.test.ts features/search/data/search-remote.test.ts features/search/presentation/view-model/use-search-view-model.test.ts` → PASS.
Run: `npm run check` → **프로젝트 전체 lint+typecheck+format 통과**(6파일이 한 계약으로 정합). 실패 시 남은 옛 참조/미사용 import 수정 후 재확인. (미변경 네이버 경로는 자체 타입으로 계속 컴파일됨.)

- [ ] **Step 5: Commit (원자적 — 6파일 + 테스트 3 + next.config 함께)**

```bash
git add shared/analytics-params.ts shared/analytics-params.test.ts \
  features/search/data/search-remote.ts features/search/data/search-remote.test.ts \
  features/search/presentation/view-model/use-search-view-model.ts \
  features/search/presentation/view-model/use-search-view-model.test.ts \
  features/search/presentation/components/ResultList.tsx \
  features/search/presentation/components/IntentChips.tsx \
  features/search/presentation/components/SearchResults.tsx
# next.config를 수정했다면 함께 add
git commit -m "feat: 검색 결과 화면을 무신사 Goods/QueryIntent로 컷오버

analytics·search-remote·viewmodel·결과카드·의도칩·결과화면을 한 계약으로 전환.
네이버 폴백 제거, 단일 Goods 리스트, 칩 제거는 rankGoods 클라 재랭크.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: 통합 검증 (전체 테스트·품질 게이트·수동 확인)

**Files:** 코드 변경 없음 예상. 누락 배선 발견 시 최소 수정(수정 파일만 명시 add — `git add -A` 금지, 작업트리에 무관 변경 존재).

**Interfaces:** Consumes Task 1~3.

- [ ] **Step 1: 전체 유닛 테스트**

Run: `npm test`
Expected: 전 테스트 PASS. **옛 네이버 테스트**(intent-chips.test.ts·remove-constraint.test.ts·reconcile-working-intent.test.ts·search-tees.test.ts 등)는 아직 존재하며 통과해야 한다(2c까지 코드 유지). 실패 시 해당 태스크로.

- [ ] **Step 2: 품질 게이트**

Run: `npm run check`
Expected: lint·typecheck·format 전부 통과.

- [ ] **Step 3: 수동 확인(개발 서버)**

`.env.local` 키가 있는 상태에서:

```
npm run dev
#  /search?q=블랙 오버핏 반팔 3만원 이하  → 이미지 카드 그리드, 제목·가격·리뷰, 칩(성별·색·핏·가격) 노출
#  칩 × 클릭 → 재랭크(에러 없이 갱신)
#  /search (빈 쿼리) → "말로 찾아보세요" 빈 상태
#  카드 클릭 → /goods/[goodsNo]는 2b 전이라 not-found (정상 — 2b에서 연결)
```

Expected: 결과 카드·칩·빈 상태가 무신사 데이터로 동작, 콘솔 에러 없음.

- [ ] **Step 4: Commit (배선 수정이 있었다면 수정 파일만)**

변경 없으면 커밋 없이 종료.

---

## 완료 후 (범위 밖 — 다음 단계)

- **2b 상세 페이지**: `goods-repository`·`use-goods-detail-view-model`·ProductDetail(갤러리·속성·**착용감**·사이즈 cm표·아웃바운드)·`/goods/[goodsNo]` 라우트. (2a가 링크를 이미 `/goods/[goodsNo]`로 걸어둠.)
- **2c 포지셔닝 + 네이버 삭제**: 홈 카피·placeholder·예시쿼리·layout 메타 + 옛 네이버 파일 및 테스트 삭제.
- **칩 제거 재검색 강화(백로그)**: 클라 `rankGoods` 재랭크는 하드 제약(성별·사이즈·가격) 제거 시 후보를 넓히지 못한다. 서버 재검색(파싱된 intent 재제출) 경로는 별도 티켓.
