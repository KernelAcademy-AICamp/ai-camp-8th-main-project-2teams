# 지표 설계 (Metrics) — Amplitude 계측
> 유형: living · 2026-07-21 · 방법: 북극성+선행+가드레일 / Build-Measure-Learn
> 도구: **Amplitude**(행동 로그·퍼널). 프로젝트 핵심이 "데이터로 의사결정"이므로 Loop 1부터 계측 필수.

## 북극성 지표 (North Star)
**검색 세션당 "원하는 티 발견" 비율** — 검색을 시작한 세션 중 **찜 또는 모의 담기**로 이어진 비율.
(JTBD "4시간+ 탐색 후 실패"의 정반대 = 빠른 발견 성공을 대표.)
보조 대표지표: **발견까지 시간**(세션 시작 → 첫 찜/모의담기).

## 선행 지표 (Leading)
| 지표 | 정의 | 왜 |
|---|---|---|
| 검색 성공률 | 검색 중 결과 클릭/찜 발생 비율 (↔ no-result·0클릭) | 검색이 실제로 맞는 걸 주나 |
| 결과 클릭률(CTR) | 노출 대비 카드 클릭 | 카드가 매력·정보 충분한가 |
| 찜(저장)률 | 세션당 찜 발생 | 발견의 대리 전환 |
| 모의 담기율 | 세션당 모의 장바구니 | 구매 전환 가능성(선행) |
| 구매의향 점수 | 인터뷰/설문 1~5 | 태도 지표 |
| 탐색시간 | 세션 시작→첫 찜 / 세션 길이 | 핵심 페인 개선 여부 |

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
| `item_saved` (찜) | product_id, from(rank/detail) |
| `mock_add_to_cart` (모의 담기) | product_id |
| `filter_applied` | attribute, value |
| `purchase_intent_rated` | score(1~5), product_id |
| `mismatch_reported` (오검색 신고) | product_id, attribute |

**핵심 퍼널**: `search_performed` → `result_clicked` → `item_saved`/`mock_add_to_cart`.
**세그먼트**: 쿼리 유형(색조합/그래픽/기능성), 신규/재방문.

## 루프별 판정 기준 (예시 — Loop1 결과 보고 확정)
- **Loop1 지속 조건(안)**: 속성 추출 정확도 임계(예 ≥80%) + 검색 성공률이 기준 이상 + 인터뷰서 "이거 쓰겠다" 다수.
- 미달 시 피봇 후보: 스키마 축소 / 추출법 교체 / 타겟·쿼리유형 좁히기.

## 미해결
- 임계 수치(정확도·성공률·찜률)의 목표선 — Loop1 베이스라인 측정 후 확정
- 탐색시간 정밀 측정 방법(세션 정의·이탈 처리)
- Amplitude 무료 한도 내 이벤트 볼륨 점검
