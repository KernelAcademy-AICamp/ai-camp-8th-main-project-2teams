from db.musinsa_upsert import _dedupe_by


def test_dedupe_by_keeps_last():
    rows = [{"k": 1, "v": "a"}, {"k": 1, "v": "b"}, {"k": 2, "v": "c"}]
    out = _dedupe_by(rows, lambda r: r["k"])
    assert {r["v"] for r in out} == {"b", "c"}
    assert len(out) == 2
