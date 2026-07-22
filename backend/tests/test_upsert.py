from db.upsert import upsert_products


class FakeExec:
    def execute(self):
        return None


class FakeTable:
    def __init__(self, log):
        self._log = log

    def upsert(self, rows, on_conflict=None):
        self._log.append({"rows": list(rows), "on_conflict": on_conflict})
        return FakeExec()


class FakeClient:
    def __init__(self):
        self.calls = []
        self.table_names = []

    def table(self, name):
        self.table_names.append(name)
        return FakeTable(self.calls)


def test_upsert_returns_count_and_uses_conflict_key():
    client = FakeClient()
    rows = [{"source_product_id": str(i)} for i in range(5)]

    n = upsert_products(client, rows, chunk_size=2)

    assert n == 5
    assert client.table_names[0] == "products"
    assert [c["on_conflict"] for c in client.calls] == [
        "source,source_product_id"
    ] * 3
    # 청크: 2 + 2 + 1
    assert [len(c["rows"]) for c in client.calls] == [2, 2, 1]


def test_upsert_empty_is_noop():
    client = FakeClient()
    assert upsert_products(client, []) == 0
    assert client.calls == []
