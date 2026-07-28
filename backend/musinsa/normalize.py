"""무신사 API 응답 → m_* 행 변환. 순수 함수(부작용 없음)."""
import re

_COLOR_PAREN = re.compile(r"\(([^()]+)\)\s*$")  # 상품명 끝 (COLOR)


def _extract_color(name: str) -> str | None:
    m = _COLOR_PAREN.search(name or "")
    return m.group(1).strip() if m else None


def normalize_plp_item(item: dict) -> dict:
    name = item.get("goodsName") or ""
    return {
        "goods_no": item.get("goodsNo"),
        "goods_name": name,
        "color": _extract_color(name),
        "price": item.get("price"),
        "final_price": item.get("finalPrice"),
        "review_count": item.get("reviewCount") or 0,
        "review_score": item.get("reviewScore"),
        "gender": item.get("displayGenderText"),
        "url": item.get("goodsLinkUrl"),
        "thumbnail": item.get("thumbnail"),
        "brand_slug": item.get("brand"),
        "brand_name": item.get("brandName"),
        "raw": item,
    }
