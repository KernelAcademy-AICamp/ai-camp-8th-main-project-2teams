# backend — 네이버 수집 → Supabase 적재

클라이밍 티셔츠 데이터 뼈대. 네이버 쇼핑 Open API로 수집해 Supabase `products`에 적재한다.
(색·프린팅 등 속성 추출·리뷰·벡터 임베딩은 범위 밖 — 다른 담당/다음 단계)

## 준비

1. 의존성 설치 (backend/에서):
   ```
   pip install -r requirements.txt
   ```
2. 환경변수: `cp .env.example .env.local` 후 값 채우기
   - `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET` — 네이버 개발자센터(검색 API)
   - `SUPABASE_URL` / `SUPABASE_SECRET_KEY` — Supabase Settings→API Keys의 secret 키(`sb_secret_...`)
3. 스키마 생성: `db/schema.sql`을 Supabase 대시보드 → SQL Editor에 붙여 실행

## 사용

- 키워드 수율 확인(수집 전 품질 점검):
  ```
  python -m ingest.probe "볼더링 티셔츠" "클라이밍 그래픽 티"
  ```
- 본 수집(시드 키워드 전체 → 적재):
  ```
  python run_ingest.py
  ```

## 테스트

```
pytest -v
```

## 구조

- `ingest/` — 네이버 호출(`naver_client`)·정제(`normalize`)·키워드(`keywords`)·수율측정(`probe`)
- `db/` — 스키마(`schema.sql`)·연결(`client`)·적재(`upsert`)
- `run_ingest.py` — 엔트리포인트
