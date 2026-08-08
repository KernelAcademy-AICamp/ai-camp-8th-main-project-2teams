# -*- coding: utf-8 -*-
"""부여 단계: 1단 LLM per-review 결과 → 극성 갈림(상반 태그만, 건수·최근가중·2/3) → 최종 review_tags.
최소 건수 임계값 없음: 1건이라도 언급된 태그는 붙인다. 건수는 극성 갈림 판정에만 쓴다.
입력: agents_out.json  =  [{"index":n,"product":str,"hits":{reviewId(str):[tags]}}, ...]
      (1단 LLM 에이전트가 리뷰별로 뽑은 태그를 reviewId 키로 모은 것)
사용: python3 부여_resolve.py agents_out.json  (기준서 §6 규칙 구현)
"""
import json, glob, sys
from datetime import date, timedelta

CUTOFF = (date.today() - timedelta(days=365)).isoformat()   # 최근 1년 = 오늘−365일 (자동 계산)
# 부여 최소 임계값 없음 — 1건이라도 언급되면 부여. 건수는 극성 갈림(상반 판정)에만.
REVDIR = "/Users/fkwlsdn/dev/team_pj/data/reviews"

# 3지선다 그룹(중립 포함): 한 값이 2/3 이상이면 채택, 아니면 그룹 전부 드롭
NWAY = {"두께": ["얇음", "두께적당", "도톰함"],
        "핏크기": ["작게나옴", "정사이즈", "크게나옴"],
        "기장": ["기장짧음", "기장적당", "기장김"]}
# 2지선다(중립 없음)
OPPOSING = [("가벼움", "무거움"), ("오버핏", "슬림핏"), ("비침없음", "비침있음"),
            ("세탁후변형없음", "세탁후줄어듦"), ("건조기OK", "건조기주의"),
            ("목안늘어남", "목늘어남"), ("프린팅튼튼", "프린팅벗겨짐"),
            ("이염없음", "물빠짐"), ("마감깔끔", "봉제불량"),
            ("화면색상일치", "화면과색상다름"), ("구김적음", "구김생김"),
            ("신축성좋음", "스판없음"), ("보풀안생김", "보풀생김")]


def load_dates(revdir):
    """revdir 안의 모든 reviews_*.json에서 리뷰id→작성일 맵. (파일 수 제한 없음)"""
    id2date = {}
    for f in sorted(glob.glob(f"{revdir}/reviews_*.json")):
        for r in json.load(open(f)).get("reviews", []):
            id2date[str(r.get("id"))] = (r.get("createDate") or "")[:10]
    return id2date


def counts(hits, id2date):
    raw, weighted = {}, {}                       # raw=독립 리뷰 수, weighted=최근 ×2
    for rid, tags in hits.items():
        d = id2date.get(str(rid))
        m = 2 if (d and d >= CUTOFF) else 1      # 날짜 못 찾으면 최근가중만 스킵(×1), 리뷰 태그는 그대로 셈
        for t in tags:
            raw[t] = raw.get(t, 0) + 1
            weighted[t] = weighted.get(t, 0) + m
    return raw, weighted


def resolve(hits, id2date):
    raw, w = counts(hits, id2date)
    tags = set(raw)   # 최소 임계값 없음 — 1건이라도 언급되면 부여
    changes = []
    # ② 3지선다 그룹
    for name, members in NWAY.items():
        pres = [m for m in members if m in tags]
        if len(pres) >= 2:
            tot = sum(w[m] for m in pres); top = max(pres, key=lambda m: w[m])
            detail = " ".join(f"{m}{w[m]}" for m in pres)
            if w[top] * 3 >= tot * 2:
                for m in pres:
                    if m != top: tags.discard(m)
                changes.append(f"[{name}] {detail} → {top}")
            else:
                for m in pres: tags.discard(m)
                changes.append(f"[{name}] {detail} 비등 → 전부 드롭")
    # ③ 2지선다
    for A, B in OPPOSING:
        if A in tags and B in tags:
            a, b = w[A], w[B]
            if a >= 2 * b: tags.discard(B); changes.append(f"{A}({a})≫{B}({b}) → {A}")
            elif b >= 2 * a: tags.discard(A); changes.append(f"{B}({b})≫{A}({a}) → {B}")
            else: tags.discard(A); tags.discard(B); changes.append(f"{A}({a})≈{B}({b}) → 둘다드롭")
    return sorted(tags), changes


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else "agents_out.json"
    revdir = sys.argv[2] if len(sys.argv) > 2 else REVDIR   # 대상 리뷰 폴더(인자, 없으면 기본값)
    data = json.load(open(src)); data.sort(key=lambda x: x["index"])
    id2date = load_dates(revdir)
    out = []
    for p in data:
        final, ch = resolve(p["hits"], id2date)
        if not final:
            final = ["unknown"]   # 분석했으나 태그 0개 → 명시 sentinel(NULL=미분석과 구분, [] 안 씀)
        out.append({"index": p["index"], "product": p["product"], "review_tags": final})
        print(f"{p['index']:>2} {p['product'][:28]:<28} {', '.join(final)}")
        for c in ch: print(f"     ⚖️  {c}")
    json.dump(out, open("final_resolved.json", "w"), ensure_ascii=False, indent=2)
    print("\n저장: final_resolved.json  (DB 미저장 — 검토용)")


if __name__ == "__main__":
    main()
