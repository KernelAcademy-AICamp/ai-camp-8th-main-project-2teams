"""동시 상세 fetch 테스트. FakeMC로 API 미호출."""
from musinsa.concurrent_ingest import fetch_one, fetch_payloads


class FakeMC:
    def __init__(self, fail_on=()):
        self.fail_on = set(fail_on)

    def product_detail(self, no):
        if no in self.fail_on:
            raise RuntimeError("boom")
        return {
            "baseCategoryFullPath": "c",
            "styleNo": f"ST{no}",
            "season": "2",
            "goodsImages": [{"imageUrl": "/images/prd_img/a.jpg"}],
        }

    def actual_size(self, no):
        return {"sizes": [{"name": "M", "items": []}]}


def _item(no):
    return {
        "goodsNo": no,
        "goodsName": f"티셔츠 {no} (BLACK)",
        "goodsLinkUrl": "u",
        "brand": "b",
        "brandName": "브",
    }


def test_fetch_one_builds_payload():
    p = fetch_one(FakeMC(), _item(10))
    assert p["product"]["goods_no"] == 10
    assert p["product"]["size_measures"] == {"sizes": [{"name": "M", "items": []}]}
    assert "style:ST10" in p["design"]["design_key"]
    assert len(p["images"]) == 1


def test_fetch_payloads_concurrent_filters_failures():
    items = [_item(n) for n in (1, 2, 3, 4)]
    out = fetch_payloads(FakeMC(fail_on={2}), items, workers=3)
    got = sorted(p["product"]["goods_no"] for p in out)
    assert got == [1, 3, 4]  # 2는 실패로 제외
