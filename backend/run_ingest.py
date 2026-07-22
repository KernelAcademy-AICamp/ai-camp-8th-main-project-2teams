"""수집 엔트리포인트. 키워드 순회 → 네이버 수집 → 정제 → Supabase upsert.
사용: cd backend && python run_ingest.py"""
from db.client import get_client
from db.upsert import upsert_products
from ingest.keywords import SEED_KEYWORDS
from ingest.naver_client import NaverClient
from ingest.normalize import normalize_item
from settings import naver_credentials


def run(naver, keywords: list[str], upsert_fn) -> dict:
    collected = 0
    kept = 0
    upserted = 0
    for kw in keywords:
        try:
            items = naver.search(kw)
            collected += len(items)
            rows = [row for row in (normalize_item(it) for it in items) if row]
            kept += len(rows)
            upserted += upsert_fn(rows)
            print(f"[{kw}] 수집 {len(items)} → 적재 {len(rows)}")
        except Exception as e:  # 개별 키워드 실패 격리 — 로그만 남기고 다음 키워드로
            print(f"[{kw}] 실패, 건너뜀: {e}")
    return {"collected": collected, "kept": kept, "upserted": upserted}


def main() -> None:
    naver = NaverClient(*naver_credentials())
    client = get_client()
    stats = run(naver, SEED_KEYWORDS, lambda rows: upsert_products(client, rows))
    print(
        f"완료: 수집 {stats['collected']} · 적재 {stats['kept']} · upsert {stats['upserted']}"
    )


if __name__ == "__main__":
    main()
