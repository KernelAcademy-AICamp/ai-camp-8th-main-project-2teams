from backfill_embeddings import backfill_embeddings


class FakeQuery:
    def __init__(self, table):
        self.table = table
        self._filter_null = False

    def select(self, *a, **k):
        return self

    def is_(self, col, val):
        self._filter_null = True
        return self

    def limit(self, n):
        return self

    def range(self, lo, hi):
        self._range = (lo, hi)
        return self

    def eq(self, col, val):
        self.table._eq = (col, val)
        return self

    def update(self, payload):
        self.table._updates.append((self.table._eq[1], payload))
        return self

    def execute(self):
        if self._filter_null:
            rows = [r for r in self.table.rows if r.get("embedding") is None]
            return type("R", (), {"data": rows, "count": len(rows)})
        return type("R", (), {"data": [], "count": 0})


class FakeTable:
    def __init__(self, rows):
        self.rows = rows
        self._updates = []
        self._eq = None

    def select(self, *a, **k):
        return FakeQuery(self).select(*a, **k)


class FakeClient:
    def __init__(self, rows):
        self._table = FakeTable(rows)

    def table(self, name):
        return self._table


def test_backfill_only_null_rows_and_writes_vectors():
    client = FakeClient([
        {"id": "1", "title": "홀로그램 곰 티", "embedding": None},
        {"id": "2", "title": "이미 있음", "embedding": [0.9]},
    ])

    def fake_embed(texts, input_type="passage"):
        return [[0.1, 0.2] for _ in texts]

    n = backfill_embeddings(client, embed_fn=fake_embed)
    assert n == 1
    updates = client._table._updates
    assert len(updates) == 1
    assert updates[0][0] == "1"
    assert updates[0][1]["embedding"] == [0.1, 0.2]
