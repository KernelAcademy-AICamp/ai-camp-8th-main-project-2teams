from musinsa.normalize import normalize_plp_item

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
