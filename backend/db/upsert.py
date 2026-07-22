"""products 멱등 적재. (source, source_product_id) 충돌 시 갱신."""
CONFLICT_KEY = "source,source_product_id"


def upsert_products(client, rows: list[dict], *, chunk_size: int = 500) -> int:
    if not rows:
        return 0
    saved = 0
    for i in range(0, len(rows), chunk_size):
        chunk = rows[i : i + chunk_size]
        client.table("products").upsert(chunk, on_conflict=CONFLICT_KEY).execute()
        saved += len(chunk)
    return saved
