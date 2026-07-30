# Phase 2b — 무신사 상세 페이지 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** 검색 결과 카드 클릭 시 여는 내부 상세 페이지 `/goods/[goodsNo]`를 만든다 — 갤러리·구조화 속성·착용감·**표준화 사이즈(cm) 표**를 "우리 기준"으로 보여주고, 하단에서 무신사로 아웃바운드한다. (2a가 카드 링크를 이미 `/goods/[goodsNo]`로 걸어둠.)

**Architecture:** 상세는 리프 흐름(route → viewmodel → repository → 컴포넌트)이라 결합이 약하다. **거의 전부 새 파일 추가**로 구현하고, 옛 네이버 상세(`/tee/[id]`·`ProductDetail`·`use-tee-detail-view-model`)는 **건드리지 않는다**(2c에서 삭제). 유일한 기존 변경은 `Goods`에 `sizeMeasures`(사이즈 실측 cm) 필드를 추가하는 것(Task 1). 데이터는 브라우저 anon Supabase로 `search_goods` 단건 조회(anon SELECT 허용). 2a·2b는 한 배포 단위.

**Tech Stack:** Next.js(App Router, Next 16 `params: Promise`, `"use client"`, React Compiler 린트) · vitest · Supabase(브라우저 anon) · GA(track).

## Global Constraints

- 데이터 계약 = `Goods`(`features/catalog/domain/goods.ts`) + `search_goods` 뷰. 클라는 그대로 소비.
- **거의 추가형**: 새 파일 위주. 유일한 기존 변경 = `Goods`/`SearchGoodsRow`/`mapGoodsRow`에 `sizeMeasures` 배선(Task 1). **옛 네이버 상세 파일 삭제 금지**(2c): `ProductDetail.tsx`·`use-tee-detail-view-model.ts`·`app/tee/[id]`·`TeeSwatch`·tee 리포지토리는 그대로 둔다.
- **React Compiler 린트**: effect 본문 동기 setState 금지. 상태 변경은 비동기 `.then()`/이벤트 콜백에서만(로더 뷰모델은 `.then()`에서 set).
- **테스트 가능성**: 데이터 접근(repository)·뷰모델은 의존성 주입으로 순수 테스트. 프레젠테이션(`GoodsDetail`)은 유닛 테스트 만들지 않음(프로젝트 관습) — `npm run check`+`npm run build`+수동으로 검증.
- 아웃바운드는 `Goods.url`(새 탭 `rel="noreferrer noopener"`), mall="무신사". 기존 상세 이벤트(`detail_viewed`·`outbound_click`·`mismatch_reported`) 유지.
- 완료 게이트: `npm run check`(lint+typecheck+format) + `npm run build`. 각 필드추가 태스크에 `npm run typecheck` 포함.
- 커밋: 한글 Conventional Commits + 트레일러 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. 경로 `client/` 기준.
- Next.js 주의(저장소 AGENTS.md): 설정/이미지 전 `node_modules/next/dist/docs/` 현재 버전 문서 확인. Next 16에서 route `params`는 `Promise`.

---

### Task 1: `Goods`에 사이즈 실측(cm) `sizeMeasures` 배선

**Files:**
- Modify: `features/catalog/domain/goods.ts`
- Modify: `features/search/data/map-goods-row.ts`
- Test: `features/search/data/map-goods-row.test.ts` (add cases)

**Interfaces:**
- Produces: `interface SizeMeasureItem { name: string; value: number; recommendSizeRange?: number }`, `interface SizeMeasureRow { name: string; items: SizeMeasureItem[] }`, `Goods.sizeMeasures: SizeMeasureRow[]`, `SearchGoodsRow.size_measures: SizeMeasureRow[] | null`, `mapGoodsRow`가 `size_measures`를 매핑(null→`[]`).

- [ ] **Step 1: Write the failing test**

`features/search/data/map-goods-row.test.ts` **하단에 describe만 추가**(기존 `base`·import 재사용, 중복 금지). 기존 `base`엔 이번 태스크에서 `size_measures: null`을 추가하므로 스프레드로 덮어쓴다:

```ts
describe("mapGoodsRow sizeMeasures", () => {
  it("size_measures 구조를 그대로 매핑", () => {
    const g = mapGoodsRow({
      ...base,
      size_measures: [{ name: "M", items: [{ name: "총장", value: 66, recommendSizeRange: 5 }] }],
    });
    expect(g.sizeMeasures).toEqual([
      { name: "M", items: [{ name: "총장", value: 66, recommendSizeRange: 5 }] },
    ]);
  });
  it("null이면 빈 배열", () => {
    expect(mapGoodsRow({ ...base, size_measures: null }).sizeMeasures).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run features/search/data/map-goods-row.test.ts`
Expected: FAIL — `SearchGoodsRow`/`Goods`에 size_measures/sizeMeasures 없음.

- [ ] **Step 3: Implement**

`features/catalog/domain/goods.ts` — 타입 추가 + `Goods`에 필드(‑ `wearChars` 아래):

```ts
// search_goods.size_measures 구조: 사이즈별 측정치(cm).
export interface SizeMeasureItem {
  name: string; // 예: 총장·어깨너비·가슴단면·소매길이
  value: number; // cm
  recommendSizeRange?: number;
}
export interface SizeMeasureRow {
  name: string; // 사이즈 라벨(S·M·Free 등)
  items: SizeMeasureItem[];
}
```

`Goods` 인터페이스 필드 추가(‑ `wearChars` 아래):

```ts
  wearChars: Partial<Record<string, string>>;
  sizeMeasures: SizeMeasureRow[]; // 사이즈 실측(cm) — 상세 표준화 사이즈 표
}
```

`features/search/data/map-goods-row.ts`:
import에 타입 추가:

```ts
import type { Goods, SizeMeasureRow } from "@/features/catalog/domain/goods";
```

`SearchGoodsRow`에 필드(‑ `wear_chars` 아래):

```ts
  wear_chars: Record<string, string> | null;
  size_measures: SizeMeasureRow[] | null;
}
```

`mapGoodsRow` 반환에 추가(‑ `wearChars` 아래):

```ts
    wearChars: row.wear_chars ?? {},
    sizeMeasures: row.size_measures ?? [],
  };
```

**필수 필드 추가로 깨지는 기존 Goods 리터럴 3곳 갱신**(안 하면 typecheck 실패):
- `features/search/data/map-goods-row.test.ts` `const base: SearchGoodsRow`에 추가: `  size_measures: null,`
- `features/search/domain/score-row.test.ts`의 `goods(p)` 팩토리 기본값에 추가: `    sizeMeasures: [],`
- `features/search/domain/rank-goods.test.ts`의 `goods(p)` 팩토리 기본값에 추가: `    sizeMeasures: [],`

- [ ] **Step 4: 테스트 + 타입 게이트**

Run: `npx vitest run features/search/data/map-goods-row.test.ts` → PASS(기존+신규 2).
Run: `npm run typecheck` → 통과(3곳 리터럴 갱신 반영).

- [ ] **Step 5: Commit**

```bash
git add features/catalog/domain/goods.ts features/search/data/map-goods-row.ts \
  features/search/data/map-goods-row.test.ts features/search/domain/score-row.test.ts \
  features/search/domain/rank-goods.test.ts
git commit -m "feat: Goods에 사이즈 실측(cm) sizeMeasures 배선

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `goods-repository` — goodsNo 단건 조회

**Files:**
- Create: `features/catalog/data/goods-repository.ts`
- Test: `features/catalog/data/goods-repository.test.ts` (create)

**Interfaces:**
- Consumes: `Goods`(goods.ts), `mapGoodsRow`·`SearchGoodsRow`(map-goods-row.ts), 브라우저 `supabase`(supabase-client.ts).
- Produces: `getByGoodsNo(goodsNo: string, fetchFn?: (n: string) => Promise<SearchGoodsRow | null>): Promise<Goods | null>`. 기본 fetchFn은 `search_goods` 뷰 단건 조회. 행 없음/에러 → null.

- [ ] **Step 1: Write the failing test**

```ts
// features/catalog/data/goods-repository.test.ts
import { describe, expect, it } from "vitest";

import type { SearchGoodsRow } from "@/features/search/data/map-goods-row";
import { getByGoodsNo } from "@/features/catalog/data/goods-repository";

function row(over: Partial<SearchGoodsRow> = {}): SearchGoodsRow {
  return {
    goods_no: 7, style_key: null, title: "블랙 반팔", brand: "브랜드", category: null,
    gender: null, season: null, color: null, colors: null, patterns: null, materials: null,
    fits: null, sizes: null, size_free: null, size_std: null, price: 19900, review_count: null,
    review_score: null, gallery: null, url: "https://musinsa.com/goods/7", thumbnail: null,
    wear_chars: null, size_measures: null, ...over,
  };
}

describe("getByGoodsNo", () => {
  it("행을 Goods로 매핑", async () => {
    const g = await getByGoodsNo("7", () => Promise.resolve(row()));
    expect(g?.goodsNo).toBe("7");
    expect(g?.title).toBe("블랙 반팔");
    expect(g?.url).toBe("https://musinsa.com/goods/7");
  });
  it("행 없으면 null", async () => {
    expect(await getByGoodsNo("404", () => Promise.resolve(null))).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run features/catalog/data/goods-repository.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
// features/catalog/data/goods-repository.ts
// 데이터 접근: search_goods 뷰 단건 조회 → Goods. 브라우저 anon(뷰는 anon SELECT 허용).
import type { Goods } from "@/features/catalog/domain/goods";
import { mapGoodsRow, type SearchGoodsRow } from "@/features/search/data/map-goods-row";

import { supabase } from "./supabase-client";

async function fetchByGoodsNo(goodsNo: string): Promise<SearchGoodsRow | null> {
  const { data, error } = await supabase
    .from("search_goods")
    .select("*")
    .eq("goods_no", goodsNo)
    .maybeSingle();
  if (error || !data) return null;
  return data as SearchGoodsRow;
}

export async function getByGoodsNo(
  goodsNo: string,
  fetchFn: (n: string) => Promise<SearchGoodsRow | null> = fetchByGoodsNo,
): Promise<Goods | null> {
  const row = await fetchFn(goodsNo);
  return row ? mapGoodsRow(row) : null;
}
```

> `maybeSingle`이 현재 `@supabase/supabase-js` 버전에 있는지 확인(없으면 `.limit(1)` 후 `data?.[0]`). 타입 에러 시 `node_modules/@supabase/...` 확인.

- [ ] **Step 4: 테스트 + 타입 게이트**

Run: `npx vitest run features/catalog/data/goods-repository.test.ts` → PASS.
Run: `npm run typecheck` → 통과(추가형).

- [ ] **Step 5: Commit**

```bash
git add features/catalog/data/goods-repository.ts features/catalog/data/goods-repository.test.ts
git commit -m "feat: goods-repository 단건 조회(getByGoodsNo) 추가

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: 상세 페이지 조립 (뷰모델 + GoodsDetail + 라우트)

**Files:**
- Create: `features/product-detail/presentation/view-model/use-goods-detail-view-model.ts`
- Create: `features/product-detail/presentation/components/GoodsDetail.tsx`
- Create: `app/goods/[goodsNo]/page.tsx`

**Interfaces:**
- Consumes: `getByGoodsNo`(Task 2), `Goods`·`SizeMeasureRow`(Task 1), `WEAR_AXES`(query-intent), `track`, `AppHeader`, 브라우저 `useSearchParams`.
- Produces: `useGoodsDetailViewModel(goodsNo, load?): { loading; goods: Goods | null }`; `GoodsDetail({ goodsNo })`; route `/goods/[goodsNo]`.

> **테스트 없음(의도적)**: 이 태스크는 훅 로더(기존 무테스트 `use-tee-detail-view-model`과 동형)·프레젠테이션·라우트뿐이라 DOM 렌더 인프라 없이는 의미 있는 유닛 테스트가 안 된다. 억지 tautological 테스트를 만들지 말 것. 검증은 `npm run check`+`npm run build`(타입·import·Next 라우트)+Task 4 수동 스모크로 한다. 로직은 Task 1·2의 순수 함수 테스트가 이미 커버한다.

- [ ] **Step 1: Implement (뷰모델)**

```ts
// features/product-detail/presentation/view-model/use-goods-detail-view-model.ts
"use client";

// ViewModel (MVVM) — 상세 화면. goodsNo로 단건 로드. 상태 변경은 .then()에서만.
import { useEffect, useState } from "react";

import { getByGoodsNo } from "@/features/catalog/data/goods-repository";
import type { Goods } from "@/features/catalog/domain/goods";

export interface GoodsDetailViewModel {
  loading: boolean;
  goods: Goods | null;
}

export function useGoodsDetailViewModel(
  goodsNo: string,
  load: (n: string) => Promise<Goods | null> = getByGoodsNo,
): GoodsDetailViewModel {
  const [goods, setGoods] = useState<Goods | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void load(goodsNo).then((data) => {
      if (!active) return;
      setGoods(data);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [goodsNo, load]);

  return { loading, goods };
}
```

- [ ] **Step 2: Implement (GoodsDetail 컴포넌트)**

```tsx
// features/product-detail/presentation/components/GoodsDetail.tsx
"use client";

// product-detail feature: 무신사 상세. goodsNo로 로드 → 갤러리·속성·착용감·사이즈(cm)표 → 무신사 아웃바운드.
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import AppHeader from "@/components/AppHeader";
import type { Goods, SizeMeasureRow } from "@/features/catalog/domain/goods";
import { WEAR_AXES } from "@/features/search/domain/query-intent";
import { track } from "@/shared/analytics";

import { useGoodsDetailViewModel } from "../view-model/use-goods-detail-view-model";

function Badges({ label, values }: { label: string; values: string[] }) {
  if (values.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-mono text-[12px] uppercase tracking-wide text-ink-soft">{label}</span>
      {values.map((v) => (
        <span key={v} className="rounded-full border border-line bg-wall px-2.5 py-0.5 text-[13px] text-ink">
          {v}
        </span>
      ))}
    </div>
  );
}

// 사이즈 실측 표: 사이즈행 × 측정치열(총장·어깨너비·가슴단면·소매길이 등, 데이터 순서 보존).
function SizeTable({ rows }: { rows: SizeMeasureRow[] }) {
  if (rows.length === 0) return null;
  const cols: string[] = [];
  for (const r of rows) for (const it of r.items) if (!cols.includes(it.name)) cols.push(it.name);
  return (
    <div className="overflow-x-auto rounded-2xl border border-line">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="bg-chalk text-ink-soft">
            <th className="px-3 py-2 text-left font-mono text-[11px] uppercase">사이즈</th>
            {cols.map((c) => (
              <th key={c} className="px-3 py-2 text-right font-mono text-[11px]">{c}(cm)</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-t border-line">
              <td className="px-3 py-2 font-semibold text-ink">{r.name}</td>
              {cols.map((c) => {
                const it = r.items.find((i) => i.name === c);
                return (
                  <td key={c} className="px-3 py-2 text-right text-ink">
                    {it ? it.value : "—"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function GoodsDetail({ goodsNo }: { goodsNo: string }) {
  const { loading, goods } = useGoodsDetailViewModel(goodsNo);
  const params = useSearchParams();
  const sid = params.get("sid");
  const [reported, setReported] = useState(false);

  useEffect(() => {
    if (loading) return;
    track("detail_viewed", { search_id: sid, product_id: goodsNo, found: Boolean(goods) });
  }, [loading, goods, goodsNo, sid]);

  const wear = goods
    ? WEAR_AXES.flatMap((axis) => {
        const v = goods.wearChars[axis];
        return v ? [`${axis}:${v}`] : [];
      })
    : [];

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-6">
        <Link href="/search" className="mb-5 inline-flex items-center gap-1 font-mono text-[12px] text-ink-soft transition hover:text-ink">
          ← 검색으로
        </Link>

        {loading ? (
          <p className="py-20 text-center font-mono text-[13px] text-ink-soft">불러오는 중…</p>
        ) : !goods ? (
          <div className="grid place-items-center py-20 text-center">
            <p className="font-display text-lg font-bold text-ink">상품을 찾을 수 없어요</p>
            <Link href="/" className="mt-3 rounded-xl bg-ink px-4 py-2 font-display text-sm font-bold text-chalk">
              처음으로
            </Link>
          </div>
        ) : (
          <div className="grid gap-8 sm:grid-cols-2">
            {/* 갤러리 */}
            <div className="flex flex-col gap-3">
              <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl border border-line bg-chalk">
                {goods.thumbnail && (
                  <Image src={goods.thumbnail} alt={goods.title} fill sizes="(max-width: 640px) 100vw, 50vw" className="object-cover" />
                )}
              </div>
              {goods.gallery.length > 1 && (
                <div className="grid grid-cols-4 gap-2">
                  {goods.gallery.slice(0, 8).map((src, i) => (
                    <div key={i} className="relative aspect-square overflow-hidden rounded-lg border border-line bg-chalk">
                      <Image src={src} alt={`${goods.title} ${String(i + 1)}`} fill sizes="20vw" className="object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 정보 */}
            <div className="flex flex-col gap-4">
              <div>
                <p className="font-mono text-[12px] uppercase tracking-wide text-ink-soft">{goods.brand}</p>
                <h1 className="mt-1 font-display text-2xl font-extrabold leading-tight tracking-tight text-ink">{goods.title}</h1>
                <div className="mt-3 flex items-center gap-3">
                  <p className="font-display text-2xl font-bold text-ink">
                    {goods.price.toLocaleString()}
                    <span className="text-sm font-medium text-ink-soft">원</span>
                  </p>
                  {goods.reviewCount > 0 && (
                    <span className="font-mono text-[12px] text-ink-soft">★ {goods.reviewScore.toFixed(1)} ({goods.reviewCount})</span>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Badges label="색" values={goods.colors} />
                <Badges label="패턴" values={goods.patterns} />
                <Badges label="소재" values={goods.materials} />
                <Badges label="핏" values={goods.fits} />
                {wear.length > 0 && <Badges label="착용감" values={wear} />}
              </div>

              {/* 우리 기준: 표준화 사이즈 실측(cm) */}
              {goods.sizeMeasures.length > 0 && (
                <div className="flex flex-col gap-2">
                  <span className="font-mono text-[12px] uppercase tracking-wide text-ink-soft">사이즈 실측(cm)</span>
                  <SizeTable rows={goods.sizeMeasures} />
                </div>
              )}

              {/* 구매 진입(outbound) — 북극성 전환 이벤트 */}
              <a
                href={goods.url}
                target="_blank"
                rel="noreferrer noopener"
                onClick={() => {
                  track("outbound_click", { search_id: sid, product_id: goods.goodsNo, mall: "무신사", from: "detail" });
                }}
                className="mt-2 rounded-xl bg-ink px-5 py-3 text-center font-display text-sm font-bold text-chalk transition hover:opacity-90"
              >
                무신사에서 구매 →
              </a>
              <p className="text-center font-mono text-[11px] text-ink-soft">무신사 상품 페이지로 이동합니다</p>

              {!reported ? (
                <button
                  type="button"
                  onClick={() => {
                    track("mismatch_reported", { search_id: sid, product_id: goods.goodsNo });
                    setReported(true);
                  }}
                  className="w-full font-mono text-[11px] text-ink-soft underline underline-offset-2 transition hover:text-ink"
                >
                  검색 조건과 안 맞아요 · 신고
                </button>
              ) : (
                <p className="text-center font-mono text-[11px] text-ink-soft">신고 접수됐어요. 고맙습니다.</p>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Implement (라우트)**

```tsx
// app/goods/[goodsNo]/page.tsx
// 페이지 3(무신사) — /goods/[goodsNo]. Next 16: params는 Promise.
import GoodsDetail from "@/features/product-detail/presentation/components/GoodsDetail";

export default async function GoodsDetailPage({
  params,
}: {
  params: Promise<{ goodsNo: string }>;
}) {
  const { goodsNo } = await params;
  return <GoodsDetail goodsNo={goodsNo} />;
}
```

- [ ] **Step 4: 전체 게이트**

Run: `npm run check` → 통과. (`Image` msscdn 호스트는 2a에서 등록됨.)
Run: `npm run build` → `/goods/[goodsNo]` 라우트 포함 빌드 성공.

- [ ] **Step 5: Commit**

```bash
git add features/product-detail/presentation/view-model/use-goods-detail-view-model.ts \
  features/product-detail/presentation/components/GoodsDetail.tsx \
  "app/goods/[goodsNo]/page.tsx"
git commit -m "feat: 무신사 상세 페이지 /goods/[goodsNo] 추가

갤러리·속성·착용감·표준화 사이즈(cm) 표 + 무신사 아웃바운드.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: 통합 검증 (전체 테스트·품질·빌드·수동)

**Files:** 코드 변경 없음 예상. 누락 배선 발견 시 최소 수정(수정 파일만 명시 add — `git add -A` 금지).

**Interfaces:** Consumes Task 1~3.

- [ ] **Step 1: 전체 유닛 테스트**

Run: `npm test`
Expected: 전 테스트 PASS. 옛 네이버 상세 테스트(있다면)·검색 테스트 모두 유지·통과.

- [ ] **Step 2: 품질 + 빌드 게이트**

Run: `npm run check` → lint·typecheck·format 통과.
Run: `npm run build` → `/goods/[goodsNo]` 포함 전 라우트 빌드 성공.

- [ ] **Step 3: 수동 확인(개발 서버)**

`.env.local` 키가 있는 상태에서:

```
npm run dev
#  /search?q=블랙 오버핏 반팔  → 카드 클릭 → /goods/[goodsNo] 열림
#  상세: 갤러리·브랜드·제목·가격·⭐리뷰·색/패턴/소재/핏 뱃지·착용감·사이즈(cm) 표
#  "무신사에서 구매" → 새 탭으로 goods.url(무신사) 이동
#  없는 goodsNo(/goods/0) → "상품을 찾을 수 없어요"
```

Expected: 2a 카드 클릭이 이제 상세로 연결됨(404 해소). 콘솔 에러 없음.

- [ ] **Step 4: Commit (배선 수정이 있었다면 수정 파일만)**

변경 없으면 커밋 없이 종료.

---

## 완료 후 (범위 밖 — 다음 단계)

- **2c 포지셔닝 + 네이버 삭제**: 홈 카피·placeholder·예시쿼리·layout 메타 갱신 + 옛 네이버 파일 삭제(`tee.ts`·`intent.ts`·옛 `intent-chips`·옛 `remove-constraint`·옛 `reconcile-working-intent`·`search-tees`·`parse-query-remote`·`match-brand`·tee 리포지토리·`TeeSwatch`·`ProductDetail.tsx`·`use-tee-detail-view-model.ts`·`app/tee/[id]`·`app/api/parse`) 및 그 테스트. `next.config`의 pstatic 이미지 패턴도 제거.
- **인터랙티브 칩 제거(백로그)**: 파싱된 QueryIntent 받는 서버 재검색 endpoint(2a에서 이월).
