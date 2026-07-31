"""search_goods.brand distinct → search_brand_aliases self-alias 시드(멱등 upsert).
safe 승격은 규칙 기반 자동(brand_aliases.is_safe_alias) — blanket 승격 금지.
수동 alias(한↔영·약칭)는 Phase 2에서 이 테이블에 직접 추가한다.
실행: cd backend && ./venv/bin/python seed_brand_aliases.py"""
from db.client import get_client
from musinsa.brand_aliases import build_alias_rows


def main() -> None:
    client = get_client()
    brands: set[str] = set()
    off = 0
    while True:
        rows = (
            client.table("search_goods").select("brand").range(off, off + 999).execute().data
        )
        if not rows:
            break
        brands.update(r["brand"] for r in rows if r.get("brand"))
        off += 1000

    alias_rows = build_alias_rows(sorted(brands))
    if alias_rows:
        client.table("search_brand_aliases").upsert(
            alias_rows, on_conflict="alias_normalized,catalog_brand"
        ).execute()
    safe = sum(1 for r in alias_rows if r["hard_filter_safe"])
    print(f"시드 완료: 브랜드 {len(brands)}개 → alias {len(alias_rows)}행 (safe {safe})")


if __name__ == "__main__":
    main()
