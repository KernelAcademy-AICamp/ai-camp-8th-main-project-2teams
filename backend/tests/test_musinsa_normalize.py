from musinsa.normalize import normalize_plp_item, design_key, is_multi_design_bundle

PLP = {
    "goodsNo": 4279165,
    "goodsName": "무등산 등산 클라이밍 티셔츠 (IVORY)",
    "goodsLinkUrl": "https://www.musinsa.com/products/4279165",
    "thumbnail": "https://image.msscdn.net/images/goods_img/x_500.jpg",
    "displayGenderText": "남성",
    "normalPrice": 39000, "price": 35000, "finalPrice": 33950,
    "brand": "while", "brandName": "와일",
    "reviewCount": 4, "reviewScore": 96,
}

def test_maps_core_fields():
    r = normalize_plp_item(PLP)
    assert r["goods_no"] == 4279165
    assert r["goods_name"] == "무등산 등산 클라이밍 티셔츠 (IVORY)"
    assert r["color"] == "IVORY"                 # (COLOR) 괄호에서 추출
    assert r["final_price"] == 33950
    assert r["review_count"] == 4
    assert r["gender"] == "남성"
    assert r["url"].endswith("4279165")
    assert r["raw"] == PLP

def test_color_none_when_no_paren():
    r = normalize_plp_item({**PLP, "goodsName": "그냥 반팔티"})
    assert r["color"] is None


def test_design_key_groups_color_variants():
    a = design_key("while", "무등산 등산 클라이밍 티셔츠 (IVORY)")
    b = design_key("while", "무등산 등산 클라이밍 티셔츠 (BLACK)")
    assert a == b                                 # 색만 다르면 같은 디자인
    c = design_key("while", "불암산 등산 클라이밍 티셔츠 (BLACK)")
    assert a != c                                 # 다른 디자인은 다른 키


def test_bundle_detected_by_name_marker():
    assert is_multi_design_bundle("오버핏 그래픽 반팔 티셔츠_5Type", 8) is True
    assert is_multi_design_bundle("클라이밍 3종 세트", 8) is True


def test_bundle_detected_by_empty_gallery():
    assert is_multi_design_bundle("평범한 그래픽 티셔츠", 0) is True


def test_normal_product_not_bundle():
    assert is_multi_design_bundle("무등산 등산 클라이밍 티셔츠 (IVORY)", 8) is False
