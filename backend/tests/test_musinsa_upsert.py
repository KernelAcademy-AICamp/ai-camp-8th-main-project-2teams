from db.musinsa_upsert import _dedupe_by, upsert_raw_goods, upsert_raw_plp_page


def test_dedupe_by_keeps_last():
    rows = [{"k": 1, "v": "a"}, {"k": 1, "v": "b"}, {"k": 2, "v": "c"}]
    out = _dedupe_by(rows, lambda r: r["k"])
    assert {r["v"] for r in out} == {"b", "c"}
    assert len(out) == 2


class _FakeTable:
    def __init__(self, log, name):
        self.log, self.name = log, name

    def upsert(self, rows, on_conflict=None):
        self.log.append((self.name, on_conflict, list(rows)))
        return self

    def execute(self):
        return type("R", (), {"data": []})


class _FakeClient:
    def __init__(self):
        self.log = []

    def table(self, name):
        return _FakeTable(self.log, name)


def test_upsert_raw_goods_uses_goods_no_conflict():
    c = _FakeClient()
    n = upsert_raw_goods(c, [{"goods_no": 1, "plp": {}}, {"goods_no": 2, "plp": {}}])
    assert n == 2
    assert c.log[0][0] == "m_raw_goods"
    assert c.log[0][1] == "goods_no"


def test_upsert_raw_goods_dedupes_by_goods_no():
    c = _FakeClient()
    n = upsert_raw_goods(c, [{"goods_no": 1, "plp": {"v": "a"}},
                             {"goods_no": 1, "plp": {"v": "b"}}])
    assert n == 1  # 같은 goods_no는 마지막만


def test_upsert_raw_plp_page_uses_composite_conflict():
    c = _FakeClient()
    n = upsert_raw_plp_page(c, [{"ingest_tag": "t", "page": 1, "payload": {}}])
    assert n == 1
    assert c.log[0][0] == "m_raw_plp_page"
    assert c.log[0][1] == "ingest_tag,page"
