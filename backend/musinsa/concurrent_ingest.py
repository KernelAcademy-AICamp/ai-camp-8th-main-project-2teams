"""동시 상세 fetch(스레드풀) + 배치 DB 쓰기(메인 스레드). 비공식 API — 워커 바운드."""
from concurrent.futures import ThreadPoolExecutor

from musinsa.normalize import assemble, detail_fields


def fetch_one(mc, item: dict) -> dict:
    """한 상품 상세+실측 fetch → assemble payload. DB 접근 없음(스레드 안전)."""
    data = mc.product_detail(item["goodsNo"])
    detail = detail_fields(data)
    payload = assemble(item, detail, brand_id=None)
    try:
        payload["product"]["size_measures"] = mc.actual_size(item["goodsNo"])
    except Exception:
        payload["product"]["size_measures"] = None
    return payload


def fetch_payloads(mc, items: list[dict], *, workers: int = 4) -> list[dict]:
    """items를 동시 fetch. 개별 실패 항목은 제외."""
    def _safe(it):
        try:
            return fetch_one(mc, it)
        except Exception:
            return None

    if not items:
        return []
    with ThreadPoolExecutor(max_workers=workers) as ex:
        return [p for p in ex.map(_safe, items) if p is not None]
