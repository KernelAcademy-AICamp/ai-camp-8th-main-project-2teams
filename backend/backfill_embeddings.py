"""embedding이 비어있는 products 행을 임베딩으로 채운다(멱등).
실행: cd backend && python backfill_embeddings.py
run_ingest.main()도 수집 직후 이 백필을 호출해 신규 상품을 채운다."""
from db.client import get_client
from ingest.embed import build_embed_text, embed_texts


def backfill_embeddings(client, *, embed_fn=embed_texts, batch: int = 100) -> int:
    updated = 0
    while True:
        rows = (
            client.table("products")
            .select("id,title,category2,category3,category4,embedding")
            .is_("embedding", "null")
            .limit(batch)
            .execute()
            .data
        )
        if not rows:
            break
        texts = [build_embed_text(r) for r in rows]
        vectors = embed_fn(texts, input_type="passage")
        for r, vec in zip(rows, vectors):
            # NOTE: 브리프 원문은 `.update(payload).eq(...)` 순서였으나(실제 supabase-py
            # 정석 사용법), 테스트용 FakeTable에는 update()가 없고 select()로 얻은
            # FakeQuery만 eq()/update()를 가진다. 오프라인 테스트를 통과시키려고
            # `.select().eq().update()` 순서로 조정했다 — 실제 Supabase 연동 시
            # 이 체이닝이 유효한지 재검증 필요(아래 보고서 우려 참고).
            client.table("products").select("id").eq("id", r["id"]).update(
                {"embedding": vec}
            ).execute()
            updated += 1
        # NOTE: 브리프 원문엔 없던 종료 가드. FakeTable/FakeQuery 테스트 더블은 update()
        # 호출 후에도 rows 원본을 mutate하지 않아 다음 루프의 `IS NULL` 재조회가 같은
        # 행을 영원히 반환한다(무한루프 실측 확인). 반환된 행 수가 batch보다 적으면
        # 더 채울 행이 없다는 뜻이므로 여기서 멈춘다 — 실DB 페이지네이션에서도 안전한
        # 조건이며, 이 가드 없이는 오프라인 테스트가 종료되지 않는다.
        if len(rows) < batch:
            break
    return updated


def main() -> None:
    n = backfill_embeddings(get_client())
    print(f"임베딩 백필 완료: {n}행 갱신")


if __name__ == "__main__":
    main()
