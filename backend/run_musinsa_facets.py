"""무신사 facet 태그(역인덱스) 적재 → m_raw_facets.
사용: cd backend && python run_musinsa_facets.py [--ingest-tag sports_patterned_v1]
      [--groups attributeMaterial,color] [--page-sleep 0.3] [--value-sleep 0.5]"""
import argparse

from db.client import get_client
from db.musinsa_upsert import upsert_raw_facets
from musinsa.client import MusinsaClient
from musinsa.facets import collect_memberships, parse_facet_values

CATEGORY = "017016005"


def load_goods(client, ingest_tag: str) -> set:
    goods, off = set(), 0
    while True:
        b = (client.table("m_raw_goods").select("goods_no").eq("ingest_tag", ingest_tag)
             .range(off, off + 999).execute().data)
        if not b:
            break
        goods |= {r["goods_no"] for r in b}
        off += 1000
        if len(b) < 1000:
            break
    return goods


def run(client, mc, *, ingest_tag: str, groups=None,
        page_sleep: float = 0.0, value_sleep: float = 0.0) -> dict:
    our = load_goods(client, ingest_tag)
    fvals = parse_facet_values(mc.filter_facets(CATEGORY))
    if groups:
        fvals = [v for v in fvals if v["parameter_key"] in set(groups)]
    rows = collect_memberships(mc, CATEGORY, fvals, our,
                               page_sleep=page_sleep, value_sleep=value_sleep)
    for r in rows:
        r["ingest_tag"] = ingest_tag
    upsert_raw_facets(client, rows)
    covered = len({r["goods_no"] for r in rows})
    print(f"facet값 {len(fvals)} · 멤버십 {len(rows)} · 커버 goods {covered}/{len(our)}")
    return {"facet_values": len(fvals), "memberships": len(rows), "goods_covered": covered}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--ingest-tag", default="sports_patterned_v1")
    ap.add_argument("--groups", default=None, help="쉼표구분 parameter_key (예: attributeMaterial,color)")
    ap.add_argument("--page-sleep", type=float, default=0.3)
    ap.add_argument("--value-sleep", type=float, default=0.5)
    args = ap.parse_args()
    groups = args.groups.split(",") if args.groups else None
    stats = run(get_client(), MusinsaClient(), ingest_tag=args.ingest_tag, groups=groups,
                page_sleep=args.page_sleep, value_sleep=args.value_sleep)
    print(f"완료: {stats}")


if __name__ == "__main__":
    main()
