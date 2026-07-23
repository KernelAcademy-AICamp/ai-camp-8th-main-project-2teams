"""네이버 응답 item → products 행 변환. 순수 함수(부작용 없음)."""
import html
import re

from ingest.gender import classify_gender

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


def _is_tshirt(item: dict) -> bool:
    """카테고리로 티셔츠만 통과. 네이버 검색은 키워드만 맞으면 키링·바지·모자·아우터·
    등산장비(카라비너 등)까지 섞어 주므로, category2~4 중 하나라도 '티셔츠'를 포함할
    때만 상품으로 인정한다(반팔/긴팔/민소매 티셔츠 등)."""
    cats = " ".join(str(item.get(f) or "") for f in ("category2", "category3", "category4"))
    return "티셔츠" in cats


def _is_short_sleeve(item: dict) -> bool:
    """소매 스코프 = 반팔만. 소매 판단은 제목 우선 — 네이버 category4의 '긴팔티셔츠'
    분류는 ≈24%가 실제로는 반팔이라 신뢰 불가. 규칙: 제목에 '긴팔'이 있으면 긴팔(제외),
    '반팔/반소매'가 있으면 반팔(유지), 둘 다 없으면 category4로 폴백(긴팔티셔츠면 제외)."""
    title = _clean_title(item.get("title", ""))
    if "긴팔" in title:
        return False
    if "반팔" in title or "반소매" in title:
        return True
    return str(item.get("category4") or "") != "긴팔티셔츠"


def normalize_item(item: dict, source: str = "naver_shopping", brand_resolver=None) -> dict | None:
    product_id = _text_or_none(item.get("productId"))
    title = _clean_title(item.get("title", ""))
    link = _text_or_none(item.get("link"))
    if not product_id or not title or not link:
        return None

    if str(item.get("productType", "")) not in ALLOWED_PRODUCT_TYPES:
        return None

    if not _is_tshirt(item):
        return None

    if not _is_short_sleeve(item):
        return None

    mall_name = _text_or_none(item.get("mallName"))
    brand = _text_or_none(item.get("brand"))
    maker = _text_or_none(item.get("maker"))
    # brand_resolver: (title, brand, maker, mall_name) -> brand_id(uuid)|None. 없으면 None.
    brand_id = brand_resolver(title, brand, maker, mall_name) if brand_resolver else None

    return {
        "source": source,
        "source_product_id": product_id,
        "mall_name": mall_name,
        "product_type": _text_or_none(item.get("productType")),
        "title": title,
        "link": link,
        "image_url": _text_or_none(item.get("image")),
        "lprice": _to_int(item.get("lprice")),
        "hprice": _to_int(item.get("hprice")),
        "brand": brand,
        "maker": maker,
        "category1": _text_or_none(item.get("category1")),
        "category2": _text_or_none(item.get("category2")),
        "category3": _text_or_none(item.get("category3")),
        "category4": _text_or_none(item.get("category4")),
        "brand_id": brand_id,
        "gender": classify_gender(title),
        "raw": item,
    }
