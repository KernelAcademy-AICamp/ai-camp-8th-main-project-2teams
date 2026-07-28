"""무신사 필터 facet 파싱 테스트."""
from musinsa.attributes import FACET_MAP, parse_facet_options


FILTER = {
    "detail": {
        "attributeMaterial": {
            "list": [
                {"displayText": "면", "value": "1^3", "parameterKey": "attributeMaterial"},
                {"displayText": "폴리에스테르", "value": "1^17", "parameterKey": "attributeMaterial"},
            ]
        },
        "color": {"list": [{"displayText": "블랙", "value": "블랙", "parameterKey": "color"}]},
    }
}


def test_facet_map_keys():
    assert FACET_MAP == {
        "colors": "color",
        "patterns": "attributePattern",
        "fits": "attributeFit",
        "materials": "attributeMaterial",
        "styles": "style",
    }


def test_parse_facet_options():
    opts = parse_facet_options(FILTER, "attributeMaterial")
    assert ("1^3", "면") in opts and ("1^17", "폴리에스테르") in opts


def test_parse_facet_options_missing():
    assert parse_facet_options(FILTER, "attributePattern") == []
