# 무신사 UI 전환 (Phase 2) · 설계

> 유형: design · 2026-07-30 · 브랜치: feature/musinsa-migration
> 선행: [Phase 1 컷오버](2026-07-30-musinsa-search-cutover-design.md) 완료(서버 `/api/search` = 무신사 `Goods[]`+`QueryIntent`). 메모리 [[musinsa-migration]].

## 1. 목표 · 문제

Phase 1로 **서버 검색 경로는 무신사로 컷오버**됐으나, **클라이언트 프레젠테이션/뷰모델·상세·홈은 아직 네이버(`Tee`/`Intent`)** 다. 현재 `search-remote.ts`가 무신사 `Goods`를 `Tee`로 타입 캐스팅만 해서 넘겨, 결과 화면에서 제목·색·핏이 안 뜨고 상세 진입(`/tee/undefined`)이 깨진 **반쯤 마이그레이션된 상태**다.

Phase 2는 클라이언트 4개 층(data·domain·viewmodel·presentation)과 진입/포지셔닝을 무신사-네이티브로 재작성하고 네이버 잔재를 제거한다.

**제품 명제**: "말로 찾는 옷" — 무신사 자체 필터로는 못 치는 **자연어 한 문장 발견 검색**을 LLM이 해준다. UI는 이 LLM 가치를 전면에 세운다.

## 2. LLM 검색 가치 (UI가 과시할 축, v1 실능력 기준)

1. **한 문장 → 다속성 의도 해석**: "여름에 시원한 루즈핏 코튼 반팔" → 계절·핏·소재·카테고리 동시 분해. (무신사는 체크박스로 하나씩)
2. **사이즈 라벨 정규화**: M·L·XL / 44·55·66 / 글자 → 통일 척도(`sizeStd` 85~130). 무신사 원페이지엔 없는 축(이번 사이즈 통일 작업의 결실).
3. **의도칩 = 신뢰 장치**: LLM이 이해한 의도를 칩으로 보여줘 "AI가 이렇게 알아들었어요"를 가시화. 칩 X로 조건 완화 재검색.

**v1 미지원(백로그)**: 프린팅 위치·레터링·그래픽 subject(비전 태그 필요) · 체형→사이즈 추천("키 178 표준체형") · vibe 의미검색.

## 3. 아키텍처 (층별 전환)

```
검색결과:  app/search/page → use-search-view-model → search-remote → /api/search(무신사)
                                    │ chips: QueryIntent → queryIntentToChips
                                    └ results: Goods[]
상세:      app/goods/[goodsNo]/page → use-goods-detail-view-model → goods-repository (search_goods 단건 + mapGoodsRow)
홈:        app/page → SearchBar · ExampleChips (무신사 예시/카피)
```

- 데이터 계약은 서버가 이미 확정(`Goods`, `QueryIntent`). 클라는 이를 **그대로 소비**(재해석/어댑터 금지).
- MVVM·Clean-lite 레이어 관습 유지(domain 순수 타입, data 접근, viewmodel 계산, presentation 표시).

## 4. 검색 결과 화면

### 4.1 의도칩 (유지 · 재매핑)
- `QueryIntent`(gender·sizeStd·priceMin/Max·style{colors·patterns·materials·fits·keywords}·exclude) → 칩 목록으로 변환하는 `queryIntentToChips`.
- **칩 X = 해당 조건 제거 후 재검색**. `QueryIntent` 기준으로 `removeConstraint`/`reconcileWorkingIntent` 재작성. 제거 단위: 각 색/패턴/소재/핏 값 개별, 성별, 사이즈(전체), 가격(전체), exclude 값.
- 읽기전용이 아닌 상호작용 칩(기존 UX 자산 계승).

### 4.2 결과 카드 (이미지 중심 커머스)
- `thumbnail` 크게 + 브랜드 + 제목 + 가격 + ⭐`reviewScore`·`reviewCount`.
- 색/핏 뱃지는 카드에 **생략**(상단 의도칩에서 이미 노출) → 카드 간결.
- 클릭 → 내부 상세 `/goods/[goodsNo]`. (검색 추적 파라미터 `sid`·`rank`·`rt` 유지)

### 4.3 폴백
- LLM 파싱 실패/타임아웃(`degraded`) 시 **빈 결과 + "다시 시도" 안내**. 네이버 로컬 폴백(`searchTees`·규칙파서) 제거.
- 쿼리 없음: 빈 상태 안내(전체 상품 덤프 안 함).

## 5. 상세 화면 ("우리만의 기준")

- `gallery[]` 캐러셀 + 브랜드·제목·가격·⭐리뷰.
- 구조화 속성 뱃지: 색·패턴·소재·핏.
- **표준화 사이즈(cm) 실측 표** — `size_measures`/`sizeStd` 기반. 차별점 전면 배치.
- 하단 **"무신사에서 구매"** 아웃바운드 버튼(`Goods.url`, 새 탭 `rel=noopener`, `track` 이벤트).
- 라우트 `/tee/[id]` → `/goods/[goodsNo]`. 단건 로드: `goods-repository.getByGoodsNo(goodsNo)`.

## 6. 진입 / 포지셔닝

무신사 실카탈로그(일반 스포츠·패턴 티 3,658건)와 v1 검색능력에 맞춰 "클라이밍 프린팅 티" 니치 프레이밍을 걷어내고 **LLM 자연어 발견 검색**으로 재정렬.

- **홈 히어로**: "말로 찾는 옷" 톤. 색·핏·소재·사이즈·가격을 한 문장으로. (구체 카피는 플랜에서 확정)
- **SearchBar placeholder(안)**: `예: 블랙 오버핏 반팔 L, 3만원 이하`
- **예시 쿼리(안)** — LLM 파싱·사이즈라벨 정규화를 과시하되 v1 능력 안(프린팅/그래픽 subject 제외):
  - "여름에 시원한 루즈핏 코튼 반팔"
  - "블랙 오버핏 반팔 L 3만원 이하"
  - "3만원 이하 여성 크롭 스트라이프"
  - "얇은 레이온 섞인 남성 반팔"
- 카피/예시 최종 문구는 플랜에서 통제 어휘(`musinsa-vocab`)와 대조해 확정.

## 7. 애널리틱스

- `shared/analytics-params.ts`: `Intent` 필드(baseColor·printColor·printPosition·graphicType·fit) → `QueryIntent` 필드(colors·patterns·materials·fits·sizeStd·priceMin/Max·gender)로 `flattenParsedAttributes`/`hasParsedConstraint` 재작성.
- `resultType`(exact/partial)은 무신사가 랭킹 top-N 단일 리스트라 의미 소멸 → 단순화(제거 또는 상수화). `deriveResultType`/`entryTypeFromSrc` 정리.
- 검색 이벤트(`search`)·아웃바운드(`outbound_click`) 추적 지점 유지·필드만 교체.

## 8. 재작성 / 신규 / 삭제

**재작성** (Tee/Intent → Goods/QueryIntent):
`features/search/data/search-remote.ts` · `features/search/presentation/view-model/use-search-view-model.ts` · `.../components/ResultList.tsx` · `SearchResults.tsx` · `IntentChips.tsx` · `SearchBar.tsx`(placeholder) · `features/search/presentation/example-queries.ts` · `features/product-detail/presentation/components/ProductDetail.tsx` · `shared/analytics-params.ts` · `app/page.tsx`(홈 카피) · `app/search/page.tsx` · `app/layout.tsx`(메타데이터)

**신규**:
`features/catalog/data/goods-repository.ts`(getByGoodsNo) · `features/search/domain/query-intent-chips.ts` · `QueryIntent`용 `remove-constraint.ts`·`reconcile-working-intent.ts`(또는 기존 파일 재작성) · `features/product-detail/presentation/view-model/use-goods-detail-view-model.ts` · `app/goods/[goodsNo]/page.tsx`

**삭제**(네이버 전용, 폴백 제거로 무참조 — 플랜에서 각 파일 미참조 확인 후):
`features/catalog/domain/tee.ts` · `catalog/presentation/TeeSwatch.tsx` · `catalog/data/{tee-repository,mock-tee-repository,supabase-tee-repository,brand-repository}.ts` · `features/search/domain/{intent,intent-chips,search-tees,parse-query,match-brand}.ts` · `features/search/data/{parse-query-remote,parse-intent-llm,search-response,embed-query}.ts` · `app/api/parse/route.ts` · `app/tee/[id]/` · 각 대응 `*.test.ts`

## 9. 테스트 · 완료 기준

- 재작성 도메인/뷰모델/매퍼는 TDD(`query-intent-chips`·`remove-constraint`·`goods-repository`·`use-goods-detail-view-model`).
- 삭제 파일의 테스트도 함께 제거, 남은 참조 0 확인.
- **완료 기준**: `client/`에서 `npm run check`(lint+typecheck+format) 그린 + 결과화면·상세·홈이 무신사 데이터로 실제 동작(빈쿼리·정상·degraded 경로 수동 확인).

## 10. 오픈 이슈 (Phase 2 밖 · 백로그)

- 브랜드 하드필터: `QueryIntent.brand` + 파서 프롬프트 + `build-goods-query`(`.ilike('brand')`) 확장 — 별도 티켓.
- 체형→사이즈 추천("키/몸무게 → 사이즈"): 파서 사이즈 추론 확장.
- 의미검색(vibe)·그래픽 subject: 비전 태그·리뷰 태그·pgvector.
- 네이버 `products`/`brands` 테이블 정리(롤백 창 종료 후).

## 11. 리스크

- **삭제 범위가 큼**(네이버 자산 대거 제거) → 플랜에서 파일별 미참조를 grep으로 확정 후 삭제. 실수 시 빌드 깨짐으로 즉시 드러남(`npm run check` 게이트).
- 예시 쿼리가 파서 실능력과 어긋나면 첫인상 훼손 → 통제 어휘·파서 프롬프트와 대조해 확정.
- `use-search-view-model`의 재검색/추적 로직이 `QueryIntent` 재작성으로 회귀 위험 → 뷰모델 테스트로 방어.
