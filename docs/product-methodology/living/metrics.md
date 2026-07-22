# 지표 설계 (Metrics) — Amplitude 계측
> 유형: living · 2026-07-21(개정 07-22) · 방법: 북극성+선행+가드레일 / Build-Measure-Learn
> 도구: **Amplitude**(행동 로그·퍼널). 프로젝트 핵심이 "데이터로 의사결정"이므로 Loop 1부터 계측 필수.
>
> **개정 사유**: 북극성을 "저장률"에서 **"상품 페이지 이동(구매 진입) 클릭"** 으로 교체. 저장(찜)은 낮은 의도의 부가 행동이라 MVP에서 제거. 결제 없는 발견·집계 제품이라 **사용자가 몰로 나가서 사는 outbound 클릭이 관측 가능한 가장 강한 전환 신호**다. (단, 실구매 확인은 불가 → 여전히 선행지표. 부트캠프 규정: GMV·CVR 직접 주장 금지와도 합치.)

## 북극성 지표 (North Star)
**검색 세션당 "구매 진입" 비율** — 검색을 시작한 세션 중 **상품 페이지로 이동(outbound 클릭)** 한 세션 비율.
(JTBD "4시간+ 탐색 후 실패"의 정반대 = 원하는 걸 찾아 **사러 나간다**.)
보조 대표지표: **구매 진입까지 시간**(세션 시작 → 첫 outbound 클릭).

## 선행 지표 (Leading) — 구매 진입 퍼널
| 지표 | 정의 | 왜 |
|---|---|---|
| 검색 성공률 | 검색 중 결과 클릭 발생 비율 (↔ no-result·0클릭) | 검색이 실제로 맞는 걸 주나 |
| 결과 클릭률(CTR) | 노출 대비 카드(행) 클릭 | 카드가 매력·정보 충분한가 |
| 상세 도달률 | 검색 세션 중 상세 진입 비율 | 비교 후 후보로 좁혀지나 |
| **구매 진입 클릭률** | 상세 대비 outbound 클릭 (핵심) | 사러 갈 만큼 확신을 줬나 |
| 구매의향 점수 | 인터뷰/설문 1~5 | 태도 지표 |
| 탐색시간 | 세션 시작→첫 outbound / 세션 길이 | 핵심 페인 개선 여부 |

## 가드레일 (Guardrail)
- **no-result율**(검색 대비 0결과) — 카탈로그 커버리지·파싱 실패 신호
- **오검색 체감**(카드 '안 맞음' 신고 / 인터뷰) — 추출 정확도 신호
- (감각축) 구매 불안·추가검색 필요성 — Loop3 리뷰 실험 시

## Amplitude 이벤트 택소노미 (Loop 1부터)
| 이벤트 | 주요 property |
|---|---|
| `search_performed` | query, parsed_attributes(색/프린팅위치/핏/소재…), result_count |
| `search_no_results` | query, parsed_attributes |
| `result_card_impression` | product_id, rank, session_query |
| `result_clicked` | product_id, rank |
| `detail_viewed` | product_id |
| **`outbound_click`** (구매 진입 — 북극성 이벤트) | product_id, mall, from(card/detail) |
| `filter_applied` | attribute, value |
| `purchase_intent_rated` | score(1~5), product_id |
| `mismatch_reported` (오검색 신고) | product_id, attribute |

> 계측 위치: 코드의 `shared/analytics.ts` `track()` seam. Loop 2에서 Amplitude로 연동. `상품 보러가기` 클릭 = `outbound_click`.

**핵심 퍼널**: `search_performed` → `result_clicked` → `detail_viewed` → **`outbound_click`**.
**세그먼트**: 쿼리 유형(색조합/그래픽/기능성), 신규/재방문.

## 루프별 판정 기준 (예시 — Loop1 결과 보고 확정)
- **Loop1 지속 조건(안)**: 속성 추출 정확도 임계(예 ≥80%) + 검색 성공률이 기준 이상 + **구매 진입 클릭이 유의미하게 발생** + 인터뷰서 "이거 쓰겠다" 다수.
- 미달 시 피봇 후보: 스키마 축소 / 추출법 교체 / 타겟·쿼리유형 좁히기.

## 미해결
- 임계 수치(정확도·성공률·구매진입률)의 목표선 — Loop1 베이스라인 측정 후 확정
- 탐색시간 정밀 측정 방법(세션 정의·이탈 처리)
- Amplitude 무료 한도 내 이벤트 볼륨 점검
- (제거됨) 저장률·모의 담기율 — MVP 스코프 아웃. 필요 시 v2에서 재검토.
