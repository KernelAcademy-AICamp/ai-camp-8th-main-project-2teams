"""m_raw_facets distinct display_text → client/features/search/data/musinsa-vocab.ts 생성.
facet 재적재 후 재실행. service 키 필요(m_raw_facets는 anon RLS 잠금)."""
import os
import collections
from pathlib import Path
from supabase import create_client

PARAM_TO_CONST = {
    "color": "COLORS",
    "attributePattern": "PATTERNS",
    "attributeMaterial": "MATERIALS",
    "attributeFit": "FITS",
}
OUT = Path(__file__).resolve().parents[2] / "client/features/search/data/musinsa-vocab.ts"


def load_env(path: str) -> None:
    for line in open(path):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k, v.strip().strip('"').strip("'"))


def main() -> None:
    load_env(str(Path(__file__).resolve().parents[2] / "client/.env.local"))
    sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SECRET_KEY"])
    vals = collections.defaultdict(set)
    start = 0
    while True:
        r = (
            sb.table("m_raw_facets")
            .select("parameter_key,display_text")
            .range(start, start + 999)
            .execute()
        )
        if not r.data:
            break
        for row in r.data:
            vals[row["parameter_key"]].add(row["display_text"])
        if len(r.data) < 1000:
            break
        start += 1000

    lines = [
        "// 무신사 통제 어휘 — m_raw_facets distinct display_text.",
        "// 자동 생성: backend/scripts/gen_musinsa_vocab.py (facet 재적재 후 재실행). 손으로 고치지 말 것.",
    ]
    for param, const in PARAM_TO_CONST.items():
        arr = sorted(vals.get(param, []))
        body = ", ".join(f'"{v}"' for v in arr)
        lines.append(f"export const {const}: readonly string[] = [{body}];")
    OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"wrote {OUT} ({', '.join(f'{c}={len(vals.get(p, []))}' for p, c in PARAM_TO_CONST.items())})")


if __name__ == "__main__":
    main()
