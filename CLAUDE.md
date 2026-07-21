# CLAUDE.md — 프로젝트 작업 규칙

이 파일은 팀과 Claude가 항상 참고하는 작업 규칙이다. Claude는 이 repo에서 커밋·브랜치·PR을 만들 때 아래 규칙을 반드시 따른다.

## 프로젝트
- **search-by-llm** — 클라이밍 프린팅 티 발견 검색 (LLM 상품검색 MVP)
- 팀: 고양이가 세상을 구한다 (김홍교·홍상호·신유정·라진우) · Kernel Academy AI Camp 8기 메인 2팀
- 기획 문서: [`docs/product-methodology/`](docs/product-methodology/) — 상세 결정은 그 안 README(D1~D12) 참고
- 실행: 3×2주 Build-Measure-Learn 린 루프 (핵심 = 데이터로 의사결정)

---

## GitHub 사용 규칙

### 브랜치 전략 (main + develop + feature/*)
- **`main`** — 안정/배포 버전. 직접 커밋·push 금지. `develop`에서 PR로만 병합.
- **`develop`** — 개발 통합 브랜치. 모든 작업 브랜치는 여기서 분기하고 여기로 병합.
- **작업 브랜치** — `develop`에서 따서 작업 후 **PR로 `develop`에 병합**. 병합되면 삭제.
- 아카데미 채점 repo(origin)의 기본 브랜치는 `main` (클래스룸 기준이라 변경하지 않음).

### 브랜치 네이밍
`<type>/<짧은-설명-kebab>` — 예: `feature/color-print-search`, `data/catalog-labeling`, `fix/search-parsing`, `docs/prd-update`
- type: `feature` `fix` `docs` `data` `chore` `refactor` `test`

### 커밋 메시지 (Conventional Commits + 한글)
`<type>: <한글 설명>` (제목 명령형, 50자 이내)
- type: `feat` `fix` `docs` `data` `chore` `refactor` `test` `style` `perf`
- 예:
  - `feat: 색×프린팅 속성 자연어 검색 추가`
  - `data: 카탈로그 50개 라벨링 및 정확도 집계`
  - `fix: 흰 바탕/노란 프린팅 색 분리 오류 수정`
  - `docs: PRD 지표 섹션 갱신`
- 본문(선택): 왜 그렇게 했는지. 필요 시 이슈 링크(`#12`).
- Claude가 만드는 커밋은 마지막에 트레일러 추가:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

### PR 규칙
- **대상 브랜치 = `develop`** (릴리즈 시에만 `develop` → `main`).
- 제목도 Conventional Commits 형식.
- 본문: **무엇을/왜** · 확인 방법(테스트·스크린샷) · 관련 문서/이슈.
- 리뷰: 가능하면 1명 확인 후 병합(비개발 팀원도 문서·데이터 PR 확인 가능). 개발 블로킹되면 작성자 병합 허용.
- 병합 방식: **squash merge** 기본(히스토리 깔끔).

### 하지 말 것
- `main`에 직접 push / force-push (`--force`) 금지.
- 비밀정보(비밀번호·API키·토큰·로그인 세션) 커밋 금지. `.env*`, `.pw-profile/`, `node_modules/`는 `.gitignore`로 제외.
- API 키는 코드에 하드코딩하지 말고 환경변수(`.env.local`)로.

---

## Claude 작업 지침
- 사용자가 **명시적으로 요청할 때만** 커밋/푸시/PR을 만든다.
- 현재 브랜치가 `main`이면, 먼저 작업 브랜치를 파고 시작한다.
- 커밋 전 비밀정보가 섞이지 않았는지 확인한다.
- 되돌리기 어려운 작업(강제 push, repo 공개범위 변경, 브랜치 삭제)은 먼저 확인받는다.
- 기획·산출물 문서는 한국어로 작성한다(파일명·브랜치·커밋 type만 영어).
