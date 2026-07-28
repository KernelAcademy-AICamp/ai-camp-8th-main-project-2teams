"""무신사 API 응답 → m_* 행 변환. 순수 함수(부작용 없음)."""
import html as _html
import json
import re

_COLOR_PAREN = re.compile(r"\(([^()]+)\)\s*$")  # 상품명 끝 (COLOR)
_CODE_TAIL = re.compile(r"[_/]?[A-Za-z0-9]{4,}\s*$")     # 끝의 모델코드
_BUNDLE = re.compile(r"(_?\d+\s*type|\d+\s*종|\d+\s*color)", re.IGNORECASE)  # 번들 마커


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


def design_key(brand_slug: str, goods_name: str) -> str:
    name = _COLOR_PAREN.sub("", goods_name or "").strip()   # (COLOR) 제거
    name = _CODE_TAIL.sub("", name).strip()                 # 모델코드 제거
    name = re.sub(r"\s+", " ", name)
    return f"{(brand_slug or '').lower()}::{name}"


def is_multi_design_bundle(goods_name: str, gallery_len: int) -> bool:
    if _BUNDLE.search(goods_name or ""):
        return True
    if gallery_len == 0:      # 개별 디자인 갤러리가 구조화 필드에 없음 = 번들/비정상
        return True
    return False


_NEXT = re.compile(r'__NEXT_DATA__"[^>]*>(\{.*?\})</script>', re.S)
_IMG_HOST = "https://image.msscdn.net"


def parse_next_data(page_html: str) -> dict:
    m = _NEXT.search(page_html or "")
    if not m:
        return {}
    try:
        d = json.loads(m.group(1))
        return d["props"]["pageProps"]["meta"]["data"]
    except (KeyError, ValueError):
        return {}


def detail_fields(data: dict) -> dict:
    gallery = [_IMG_HOST + im["imageUrl"] for im in (data.get("goodsImages") or [])
               if im.get("imageUrl")]
    chars = {}
    for grp in (data.get("goodsMaterial") or {}).get("materials", []):
        sel = [it["name"] for it in grp.get("items", []) if it.get("isSelected")]
        if sel:
            chars[grp["name"]] = ", ".join(sel)
    return {
        "category_full": data.get("baseCategoryFullPath"),
        "style_no": data.get("styleNo"),
        "season": data.get("season"),
        "gallery": gallery,
        "review_chars": chars,
    }
