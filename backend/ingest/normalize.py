"""네이버 응답 item → products 행 변환. 순수 함수(부작용 없음)."""
import html
import re

ALLOWED_PRODUCT_TYPES = {"1", "2"}  # 일반 단일상품만(중고·단종·카탈로그 제외)

_B_TAG = re.compile(r"</?b>")


def _clean_title(title: str) -> str:
    return html.unescape(_B_TAG.sub("", title or "")).strip()


def _to_int(value) -> int | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text.isdigit():
        return None
    return int(text)


def _text_or_none(value) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def normalize_item(item: dict, source: str = "naver_shopping") -> dict | None:
    product_id = _text_or_none(item.get("productId"))
    title = _clean_title(item.get("title", ""))
    link = _text_or_none(item.get("link"))
    if not product_id or not title or not link:
        return None

    if str(item.get("productType", "")) not in ALLOWED_PRODUCT_TYPES:
        return None

    return {
        "source": source,
        "source_product_id": product_id,
        "mall_name": _text_or_none(item.get("mallName")),
        "product_type": _text_or_none(item.get("productType")),
        "title": title,
        "link": link,
        "image_url": _text_or_none(item.get("image")),
        "lprice": _to_int(item.get("lprice")),
        "hprice": _to_int(item.get("hprice")),
        "brand": _text_or_none(item.get("brand")),
        "maker": _text_or_none(item.get("maker")),
        "category1": _text_or_none(item.get("category1")),
        "category2": _text_or_none(item.get("category2")),
        "category3": _text_or_none(item.get("category3")),
        "category4": _text_or_none(item.get("category4")),
        "raw": item,
    }
