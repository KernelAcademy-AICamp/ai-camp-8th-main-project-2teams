from ingest.normalize import normalize_item

SAMPLE = {
    "title": "블랙야크 반팔 <b>티셔츠</b> 남성 &amp; 여성",
    "link": "https://smartstore.naver.com/main/products/13347585855",
    "image": "https://shopping-phinf.pstatic.net/x/img.jpg",
    "lprice": "39000",
    "hprice": "",
    "mallName": "블랙야크 부산녹산점",
    "productId": "90892096187",
    "productType": "2",
    "brand": "블랙야크",
    "maker": "블랙야크",
    "category1": "스포츠/레저",
    "category2": "등산",
    "category3": "등산의류",
    "category4": "반팔티셔츠",
}


def test_maps_fields_and_cleans_title():
    row = normalize_item(SAMPLE)
    assert row is not None
    assert row["title"] == "블랙야크 반팔 티셔츠 남성 & 여성"  # <b> 제거 + 엔티티 복원
    assert row["source"] == "naver_shopping"
    assert row["source_product_id"] == "90892096187"
    assert row["product_type"] == "2"
    assert row["link"].endswith("13347585855")
    assert row["image_url"].endswith("img.jpg")


def test_price_casting():
    row = normalize_item(SAMPLE)
    assert row["lprice"] == 39000
    assert row["hprice"] is None  # "" → None


def test_keeps_raw():
    row = normalize_item(SAMPLE)
    assert row["raw"] == SAMPLE


def test_filters_non_purchasable_product_type():
    used = {**SAMPLE, "productType": "4"}  # 중고
    assert normalize_item(used) is None


def test_keeps_product_type_1():
    t1 = {**SAMPLE, "productType": "1"}
    assert normalize_item(t1) is not None


def test_missing_required_returns_none():
    no_id = {**SAMPLE}
    del no_id["productId"]
    assert normalize_item(no_id) is None
