"""무신사 필터 facet → 속성 역인덱스. 순수 파싱 + 집계."""

FACET_MAP = {
    "colors": "color",
    "patterns": "attributePattern",
    "fits": "attributeFit",
    "materials": "attributeMaterial",
    "styles": "style",
}


def parse_facet_options(filter_data: dict, param_key: str) -> list[tuple[str, str]]:
    """filter API의 data(dict)에서 특정 param의 (value, displayText) 옵션 리스트."""
    group = (filter_data.get("detail") or {}).get(param_key) or {}
    return [
        (it["value"], it["displayText"])
        for it in group.get("list", [])
        if it.get("value") is not None
    ]
