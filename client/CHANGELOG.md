## [0.2.3](https://github.com/KernelAcademy-AICamp/ai-camp-8th-main-project-2teams/compare/v0.2.2...v0.2.3) (2026-07-24)

### Features

* products에 디자인(컷) 적재용 스키마 확장 ([a0e9a83](https://github.com/KernelAcademy-AICamp/ai-camp-8th-main-project-2teams/commit/a0e9a83cd78ae3dc2225979a0c1379f2d7ef7548))
* Sentry 에러 추적 도입(클라·서버·global-error) ([#22](https://github.com/KernelAcademy-AICamp/ai-camp-8th-main-project-2teams/issues/22)) ([c173210](https://github.com/KernelAcademy-AICamp/ai-camp-8th-main-project-2teams/commit/c173210adbf2c17f6e2518124e353d0547fffcde))
* Sentry→Slack 알림 릴레이 라우트 ([#23](https://github.com/KernelAcademy-AICamp/ai-camp-8th-main-project-2teams/issues/23)) ([63c737a](https://github.com/KernelAcademy-AICamp/ai-camp-8th-main-project-2teams/commit/63c737a02a698f30e34b8c63e4eca136780bd15a))

### Bug Fixes

* upsert 충돌키를 (source, source_product_id, variant)로 변경 ([214aba5](https://github.com/KernelAcademy-AICamp/ai-camp-8th-main-project-2teams/commit/214aba5fe6231e3a3e448bf825e5532defd0dc0d))
## [0.2.2](https://github.com/KernelAcademy-AICamp/ai-camp-8th-main-project-2teams/compare/v0.2.1...v0.2.2) (2026-07-23)

### Features

* client↔Supabase 연결 (실상품 데이터 소스 전환) ([#14](https://github.com/KernelAcademy-AICamp/ai-camp-8th-main-project-2teams/issues/14)) ([3198a6e](https://github.com/KernelAcademy-AICamp/ai-camp-8th-main-project-2teams/commit/3198a6e46b63d9b9405944751570b4db3d75c937))
* DB 백업 스크립트 추가 (로컬 전용 pg_dump 덤프) ([#16](https://github.com/KernelAcademy-AICamp/ai-camp-8th-main-project-2teams/issues/16)) ([d1e7968](https://github.com/KernelAcademy-AICamp/ai-camp-8th-main-project-2teams/commit/d1e7968e799f4c516eceeb899e665310acde9e08))
* 검색 UX 마무리 — 정확/부분 일치·의도칩 삭제·파싱 지연 대응 ([#15](https://github.com/KernelAcademy-AICamp/ai-camp-8th-main-project-2teams/issues/15)) ([60d0ac4](https://github.com/KernelAcademy-AICamp/ai-camp-8th-main-project-2teams/commit/60d0ac4d8c5c784bbf479025b66e1aeee5a182c1))
* 브랜드 사전·검색축 추가 (수집 확장·brand_id FK) ([#18](https://github.com/KernelAcademy-AICamp/ai-camp-8th-main-project-2teams/issues/18)) ([d395752](https://github.com/KernelAcademy-AICamp/ai-camp-8th-main-project-2teams/commit/d395752177174d379b8f8ea194e4d6592f263bc6))
* 브랜드 칩 즉시 표시 (+ 사전 문서 최신화) ([#19](https://github.com/KernelAcademy-AICamp/ai-camp-8th-main-project-2teams/issues/19)) ([ee798a0](https://github.com/KernelAcademy-AICamp/ai-camp-8th-main-project-2teams/commit/ee798a0b1d57ba284f014b933edccae2c73c1216))
* 상품 성별(gender) 분류 컬럼·검색축 + 파스 모델 교체 ([#20](https://github.com/KernelAcademy-AICamp/ai-camp-8th-main-project-2teams/issues/20)) ([57db271](https://github.com/KernelAcademy-AICamp/ai-camp-8th-main-project-2teams/commit/57db271a057f15b425e29a9044b119780404223a))
## [0.2.1](https://github.com/KernelAcademy-AICamp/ai-camp-8th-main-project-2teams/compare/v0.2.0...v0.2.1) (2026-07-22)

### Features

* **backend:** 네이버 쇼핑 수집 → Supabase 뼈대 DB ([#13](https://github.com/KernelAcademy-AICamp/ai-camp-8th-main-project-2teams/issues/13)) ([9b24b40](https://github.com/KernelAcademy-AICamp/ai-camp-8th-main-project-2teams/commit/9b24b40d142f0a00788cbc53fc0ddc45dd1fb303))
## 0.2.0 (2026-07-22)

### Features

* **client:** Chalk & Holds 디자인 시스템 (폰트·토큰·글로벌) ([29f0340](https://github.com/KernelAcademy-AICamp/ai-camp-8th-main-project-2teams/commit/29f034098670e06f46ad3b15a18be4b992282db8))
* **client:** Clean Architecture-lite 레이어 (도메인·데이터·유스케이스) ([e0b815f](https://github.com/KernelAcademy-AICamp/ai-camp-8th-main-project-2teams/commit/e0b815f8ce7489841a307d5359405190bfbd2435))
* **client:** 검색·결과·상세 3페이지 + 찜 (MVVM) ([6a1b6aa](https://github.com/KernelAcademy-AICamp/ai-camp-8th-main-project-2teams/commit/6a1b6aa97006623954c361ccae45e03e11ec3428))
* **client:** 저장(찜) 제거, 구매 진입(outbound) 전환으로 교체 ([cb65ada](https://github.com/KernelAcademy-AICamp/ai-camp-8th-main-project-2teams/commit/cb65ada39fac1f86169cde515b4137054cf05ed5))
* 검색어 LLM 파싱 추가 (NVIDIA qwen3-next) ([e65b2a0](https://github.com/KernelAcademy-AICamp/ai-camp-8th-main-project-2teams/commit/e65b2a02d43bd1c2ba59d93aabca03e557deaaa9))
* 수동 Release 워크플로우 전환 (release-please 대체) ([#10](https://github.com/KernelAcademy-AICamp/ai-camp-8th-main-project-2teams/issues/10)) ([574cd61](https://github.com/KernelAcademy-AICamp/ai-camp-8th-main-project-2teams/commit/574cd6111920dd7a2de2bf2109ae4e9604223e7d))

### Bug Fixes

* CI 중복 트리거 제거 + release-please/promote를 GITHUB_TOKEN으로 전환 ([#9](https://github.com/KernelAcademy-AICamp/ai-camp-8th-main-project-2teams/issues/9)) ([7d64605](https://github.com/KernelAcademy-AICamp/ai-camp-8th-main-project-2teams/commit/7d646053b6edf16fa4a6aecc2c8d9af9b35284f2))
* release-please target-branch를 develop로 지정 ([#8](https://github.com/KernelAcademy-AICamp/ai-camp-8th-main-project-2teams/issues/8)) ([4488ec2](https://github.com/KernelAcademy-AICamp/ai-camp-8th-main-project-2teams/commit/4488ec253bc441502c3f2eccd030b4452e4df3ff))
