[![Review Assignment Due Date](https://classroom.github.com/assets/deadline-readme-button-22041afd0340ce965d47ae6ef1cefeee28c7c493a6346c4f15d667ab976d596c.svg)](https://classroom.github.com/a/yBcYDqOF)

# search-by-llm — 클라이밍 프린팅 티 발견 검색

> Kernel Academy AI Camp 8기 · 메인 프로젝트 2팀 · **팀명: 고양이가 세상을 구한다** 🐱
> ⚠️ 진행 중(WIP) — 문서·코드는 계속 다듬어집니다.

## 한 줄 소개
클라이머가 **말로 표현한 시각·감각 속성**("등판에 노란 프린팅 있는 시원한 흰 티")으로 프린팅 반팔 티셔츠를 찾아주는 **LLM 상품 발견 검색** 서비스.

## 왜 만드나 (문제)
튀는 색 클라이밍화에 어울리는 백프린팅 티를 찾고 싶어도, 네이버·무신사 검색은 색을 옷 전체로만 인식해 **"바탕 흰 + 프린팅만 노란"** 같은 조합을 표현하지 못한다. 결과는 대표 썸네일뿐이라 등판·소재·사이즈를 상품마다 상세페이지로 확인해야 하고, 공급도 인스타·암장·직구·중고로 흩어져 있다. → 실제로 **4시간을 쓰고도 원하는 티를 못 찾는** 문제.

## 무엇을 (해결)
흩어진 클라이밍 티를 모아, **속성 조합(색×프린팅위치·핏·기능성)으로 '말로' 검색하고 '한눈에' 비교**하는 발견 검색.

- 🎯 **첫 타겟**: 클라이머 (백프린팅 티에 진심인 커뮤니티)
- 🔍 **핵심 기능**: 자연어 쿼리 → LLM이 속성으로 파싱 → 속성 검색·랭킹 → 등판·색칩·핵심속성이 보이는 결과 카드
- 🧩 **데이터**: 네이버 쇼핑 API 수집 + 상품 이미지에서 비전 LLM으로 속성 추출(색·프린팅·그래픽·핏·소재추정)

## 어떻게 (실행 구조)
**3 × 2주 Build-Measure-Learn 린 루프.** 이 프로젝트의 핵심은 완성도가 아니라 **Amplitude 데이터로 매 루프 의사결정하는 과정**을 증명하는 것.

| 루프 | 초점 |
|---|---|
| Loop 1 (W1-2) | 가치 검증 + 최소 자동추출 → 배포 → Amplitude·인터뷰 → 의사결정 |
| Loop 2 (W3-4) | Loop1 데이터가 가리키는 곳에 투자 |
| Loop 3 (W5-6) | 정밀화·전환·확장 + 최종 산출물 |

## 팀
| 이름 | 역할 |
|---|---|
| 김홍교 | 개발 총괄 · LLM 검색 파이프라인 · API 연동 · 앱/배포 |
| 홍상호 | 카탈로그 구축 · 속성 스키마/라벨 기준 정의 |
| 신유정 | 이미지 속성 추출 · 시각속성 검증 |
| 라진우 | 감각·기능성 속성 오너 · 리뷰 샘플 분석 · 사용자 인터뷰 |

## 기술 스택 (예정)
Next.js · shadcn/ui · Supabase · OpenAI/비전 LLM · 네이버 쇼핑 오픈API · Amplitude · Vercel

## 문서
기획 산출물은 [`docs/product-methodology/`](docs/product-methodology/)에 있습니다.
- [기획 인덱스 & 핵심 결정](docs/product-methodology/README.md)
- [PRD](docs/product-methodology/living/prd.md) · [MVP·스프린트](docs/product-methodology/living/mvp-plan.md) · [지표(Amplitude)](docs/product-methodology/living/metrics.md)
- [고객 프로필/JTBD](docs/product-methodology/living/customer-profile.md) · [문제 검증](docs/product-methodology/foundation/problem-validation.md) · [데이터 현실성](docs/product-methodology/foundation/data-feasibility.md)

## 브랜치
- `main` — 안정 버전 · `develop` — 개발 통합 브랜치(기능 작업은 여기서)
