import { beforeEach, describe, expect, it, vi } from "vitest";

import { EMPTY_INTENT } from "@/features/search/domain/query-intent";

const parseMock = vi.fn();
const aliasMock = vi.fn();
const dbResult = vi.fn();

vi.mock("@/features/search/data/parse-query-intent", () => ({
  parseQueryIntent: (...a: unknown[]) => parseMock(...a) as never,
}));
vi.mock("@/features/search/data/brand-alias-repository", () => ({
  getSafeBrandAliases: (...a: unknown[]) => aliasMock(...a) as never,
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: () => ({ select: () => chainable() }),
  }),
}));

// DB 체인 호출 기록 — 결정화 레인(flag-on) 테스트에서 하드 조건 유무를 단언하는 데 쓴다.
const dbCalls: [string, ...unknown[]][] = [];

function chainable(): unknown {
  const self: Record<string, unknown> = {};
  for (const m of [
    "eq",
    "or",
    "gte",
    "lte",
    "overlaps",
    "not",
    "order",
    "limit",
    "ilike",
  ]) {
    self[m] = (...args: unknown[]) => {
      dbCalls.push([m, ...args]);
      return self;
    };
  }
  self.then = (resolve: (v: unknown) => unknown) => resolve(dbResult());
  return self;
}

async function post(query: string): Promise<{ status: number; body: never }> {
  const { POST } = await import("@/app/api/search/route");
  const res = await POST(
    new Request("http://test/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    }),
  );
  return { status: res.status, body: (await res.json()) as never };
}

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs(); // SEARCH_DECISIVE_LANE 등 직전 테스트의 stub 누출 방지
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://x");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "k");
  parseMock.mockReset();
  aliasMock.mockReset();
  dbResult.mockReset();
  dbCalls.length = 0;
  aliasMock.mockResolvedValue([{ aliasNormalized: "나이키", catalogBrand: "나이키" }]);
  dbResult.mockReturnValue({ data: [], error: null });
});

describe("POST /api/search — mode 계약", () => {
  it("파서 성공+색 신호 → full", async () => {
    parseMock.mockResolvedValue({
      intent: { ...EMPTY_INTENT, style: { ...EMPTY_INTENT.style, colors: ["블랙"] } },
      degraded: false,
    });
    const { body } = await post("검정 티");
    expect((body as { mode: string }).mode).toBe("full");
  });

  it("파서 실패+브랜드 매칭 → lexical_only + brand 세팅", async () => {
    parseMock.mockResolvedValue({ intent: EMPTY_INTENT, degraded: true });
    const { body } = await post("나이키 반팔");
    const b = body as { mode: string; intent: { brand?: string } };
    expect(b.mode).toBe("lexical_only");
    expect(b.intent.brand).toBe("나이키");
  });

  it("파서 실패+가격만 신호 → lexical_only + priceMax override", async () => {
    parseMock.mockResolvedValue({ intent: EMPTY_INTENT, degraded: true });
    aliasMock.mockResolvedValue([]);
    dbResult.mockReturnValue({ data: [], error: null });
    const { body } = await post("2만원 이하");
    const b = body as { mode: string; intent: { priceMax?: number } };
    expect(b.mode).toBe("lexical_only");
    expect(b.intent.priceMax).toBe(20000);
  });

  it("파서 성공+빈 파싱+무매칭 → failed, DB 미조회(일반 상위 미노출)", async () => {
    parseMock.mockResolvedValue({ intent: EMPTY_INTENT, degraded: false });
    // "그냥 좀"은 extractTitleTokens 스톱워드(ETC_STOP)로 전부 제거되어 titleTokens도
    // 비므로 순수 무신호 케이스 유지. ("아무말"은 title 토큰 배선 후 자체가 잔여
    // 토큰으로 살아남아 signal이 되므로 이 무신호 회귀 케이스에 더 이상 맞지 않음.)
    const { body } = await post("그냥 좀");
    const b = body as { mode: string; results: unknown[] };
    expect(b.mode).toBe("failed");
    expect(b.results).toEqual([]);
    expect(dbResult).not.toHaveBeenCalled();
  });

  it("사전 조회 실패 → failed", async () => {
    parseMock.mockResolvedValue({ intent: EMPTY_INTENT, degraded: false });
    aliasMock.mockRejectedValue(new Error("boom"));
    const { body } = await post("나이키 반팔");
    expect((body as { mode: string }).mode).toBe("failed");
  });

  it("사전 조회 실패 + 명시 가격 → failed이지만 priceMax override 반영", async () => {
    parseMock.mockResolvedValue({
      intent: { ...EMPTY_INTENT, priceMax: 2000 },
      degraded: false,
    });
    aliasMock.mockRejectedValue(new Error("boom"));
    const { body } = await post("2만원 이하 반팔");
    const b = body as { mode: string; intent: { priceMax: number } };
    expect(b.mode).toBe("failed");
    expect(b.intent.priceMax).toBe(20000);
  });

  it("검색 DB 오류 → failed", async () => {
    parseMock.mockResolvedValue({ intent: EMPTY_INTENT, degraded: true });
    dbResult.mockReturnValue({ data: null, error: { message: "db down" } });
    const { body } = await post("나이키 반팔");
    expect((body as { mode: string }).mode).toBe("failed");
  });
});

describe("POST /api/search — 제목 tier 폴백", () => {
  it("잔여 토큰 있으면 phrase tier부터 실행, 24개 채우면 중단", async () => {
    parseMock.mockResolvedValue({ intent: EMPTY_INTENT, degraded: false });
    aliasMock.mockResolvedValue([]);
    // phrase tier가 24개 이상 반환 → 1회 조회로 종료
    const rows = Array.from({ length: 30 }, (_, i) => ({
      goods_no: i + 1,
      title: `드라이핏 반팔 ${String(i)}`,
      brand: "b",
      review_score: 4,
      review_count: 1,
    }));
    dbResult.mockReturnValue({ data: rows, error: null });
    const { body } = await post("드라이핏 쿨링소재");
    const b = body as {
      mode: string;
      intent: { titleTokens?: string[] };
      titleTier: string;
    };
    expect(b.mode).toBe("full");
    expect(b.intent.titleTokens).toEqual(["드라이핏", "쿨링소재"]);
    expect(b.titleTier).toBe("phrase");
    expect(dbResult).toHaveBeenCalledTimes(1);
  });

  it("상위 tier가 부족하면 다음 tier로 폴백·dedup", async () => {
    parseMock.mockResolvedValue({ intent: EMPTY_INTENT, degraded: false });
    aliasMock.mockResolvedValue([]);
    const mk = (from: number, n: number) =>
      Array.from({ length: n }, (_, i) => ({
        goods_no: from + i,
        title: `t${String(from + i)}`,
        brand: "b",
        review_score: 4,
        review_count: 1,
      }));
    dbResult
      .mockReturnValueOnce({ data: mk(1, 5), error: null }) // phrase: 5
      .mockReturnValueOnce({ data: mk(3, 10), error: null }) // and: 10 (3~7 중복)
      .mockReturnValueOnce({ data: mk(10, 30), error: null }); // or: 30
    const { body } = await post("드라이핏 쿨링소재");
    const b = body as { results: { goodsNo: string }[]; titleTier: string };
    expect(b.titleTier).toBe("or");
    expect(dbResult).toHaveBeenCalledTimes(3);
    const nos = b.results.map((r) => r.goodsNo);
    expect(new Set(nos).size).toBe(nos.length); // dedup
    expect(nos[0]).toBe("1"); // 상위 tier(phrase) 우선 배치
  });

  it("잔여 토큰 없으면 기존 단일 쿼리(기존 계약 회귀 없음)", async () => {
    parseMock.mockResolvedValue({
      intent: { ...EMPTY_INTENT, style: { ...EMPTY_INTENT.style, colors: ["블랙"] } },
      degraded: false,
    });
    aliasMock.mockResolvedValue([]);
    dbResult.mockReturnValue({ data: [], error: null });
    const { body } = await post("검정 반팔");
    expect((body as { titleTier: unknown }).titleTier).toBeNull();
    expect(dbResult).toHaveBeenCalledTimes(1);
  });

  it("파서 실패+잔여 토큰 → lexical_only", async () => {
    parseMock.mockResolvedValue({ intent: EMPTY_INTENT, degraded: true });
    aliasMock.mockResolvedValue([]);
    dbResult.mockReturnValue({ data: [], error: null });
    const { body } = await post("드라이핏 쿨링소재");
    expect((body as { mode: string }).mode).toBe("lexical_only");
  });
});

describe("POST /api/search — 제목 0건 구제(v3.2)", () => {
  it("전 tier 0건 + 환각 스타일 하드필터 → 스타일 제거 재스윕이 결과 반환", async () => {
    parseMock.mockResolvedValue({
      intent: { ...EMPTY_INTENT, style: { ...EMPTY_INTENT.style, patterns: ["카모"] } },
      degraded: false,
    });
    aliasMock.mockResolvedValue([]);
    const rows = Array.from({ length: 30 }, (_, i) => ({
      goods_no: i + 1,
      title: `택티컬 티셔츠 ${String(i)}`,
      brand: "b",
      review_score: 4,
      review_count: 1,
    }));
    dbResult
      .mockReturnValueOnce({ data: [], error: null }) // 원본: phrase 0건
      .mockReturnValueOnce({ data: [], error: null }) // 원본: and 0건
      .mockReturnValueOnce({ data: [], error: null }) // 원본: or 0건
      .mockReturnValue({ data: rows, error: null }); // salvage: phrase에서 24개 이상 채움

    const { body } = await post("드라이핏 쿨링소재");
    const b = body as {
      mode: string;
      titleSalvage: boolean;
      intent: { style: { patterns: string[] } };
      results: unknown[];
    };
    expect(b.mode).toBe("full");
    expect(b.titleSalvage).toBe(true);
    expect(b.intent.style.patterns).toEqual([]);
    expect(b.results.length).toBeGreaterThan(0);
    expect(dbResult).toHaveBeenCalledTimes(4); // 원본 3(전부 0건) + salvage 1(24개 이상 채움)
  });

  it("스타일 하드필터 없는 intent + 전 tier 0건 → 재시도 없음", async () => {
    parseMock.mockResolvedValue({ intent: EMPTY_INTENT, degraded: false });
    aliasMock.mockResolvedValue([]);
    dbResult.mockReturnValue({ data: [], error: null });

    const { body } = await post("드라이핏 쿨링소재");
    const b = body as { titleSalvage: boolean; results: unknown[] };
    expect(b.titleSalvage).toBe(false);
    expect(b.results).toEqual([]);
    expect(dbResult).toHaveBeenCalledTimes(3);
  });
});

describe("POST /api/search — 결정적 가격 파서(P0-①)", () => {
  it("LLM이 '2만원 이하'를 오파싱해도 명시 가격이 결정적으로 override", async () => {
    // LLM 환각 재현: priceMax를 2000으로 잘못 파싱.
    parseMock.mockResolvedValue({
      intent: { ...EMPTY_INTENT, priceMax: 2000 },
      degraded: false,
    });
    aliasMock.mockResolvedValue([]);
    dbResult.mockReturnValue({ data: [], error: null });
    const { body } = await post("2만원 이하 반팔");
    const b = body as { intent: { priceMin?: number; priceMax?: number } };
    expect(b.intent.priceMax).toBe(20000);
    expect(b.intent.priceMin).toBeUndefined();
  });

  it("명시 가격 표현이 없으면 LLM 값을 유지", async () => {
    parseMock.mockResolvedValue({
      intent: { ...EMPTY_INTENT, priceMax: 2000 },
      degraded: false,
    });
    aliasMock.mockResolvedValue([]);
    dbResult.mockReturnValue({ data: [], error: null });
    const { body } = await post("가성비 반팔");
    const b = body as { intent: { priceMax?: number } };
    expect(b.intent.priceMax).toBe(2000);
  });
});

describe("POST /api/search — titleTokens 폐기 fallback(P0-②)", () => {
  it("sizeStd 있는 intent + 대화 필러 titleTokens + 전 tier·구제 0건 → fallback 쿼리 실행", async () => {
    // "105"는 숫자라 titleTokens에서 필터되지만, "저기"·"그거"·"있나요"는 대화 필러로 살아남아
    // 제목 하드 게이트가 되어 실사이즈 검색(105)을 전멸시킬 수 있는 케이스를 재현한다.
    parseMock.mockResolvedValue({
      intent: { ...EMPTY_INTENT, sizeStd: [105] },
      degraded: false,
    });
    aliasMock.mockResolvedValue([]);
    const rows = Array.from({ length: 5 }, (_, i) => ({
      goods_no: i + 1,
      title: `기본 반팔 ${String(i)}`,
      brand: "b",
      review_score: 4,
      review_count: 1,
      size_std: [105],
    }));
    dbResult
      .mockReturnValueOnce({ data: [], error: null }) // 원본: phrase 0건
      .mockReturnValueOnce({ data: [], error: null }) // 원본: and 0건
      .mockReturnValueOnce({ data: [], error: null }) // 원본: or 0건
      .mockReturnValueOnce({ data: rows, error: null }); // fallback: titleTokens 제거 단일 쿼리

    const { body } = await post("저기 그거 105 있나요");
    const b = body as {
      mode: string;
      titleTier: string | null;
      titleDropped: boolean;
      intent: { titleTokens?: string[] };
      results: unknown[];
    };
    expect(dbResult).toHaveBeenCalledTimes(4);
    expect(b.results.length).toBeGreaterThan(0);
    expect(b.titleDropped).toBe(true);
    expect(b.titleTier).toBeNull();
    expect(b.intent.titleTokens ?? []).toEqual([]);
  });

  it("titleTokens만 유일 신호(다른 하드 조건 없음) + 전 tier 0건 → fallback 미실행", async () => {
    parseMock.mockResolvedValue({ intent: EMPTY_INTENT, degraded: false });
    aliasMock.mockResolvedValue([]);
    dbResult.mockReturnValue({ data: [], error: null });

    const { body } = await post("저기 그거 있나요");
    const b = body as { titleDropped: boolean; results: unknown[] };
    expect(dbResult).toHaveBeenCalledTimes(3);
    expect(b.titleDropped).toBe(false);
    expect(b.results).toEqual([]);
  });

  it("titleTokens+스타일 필터+다른 하드조건+모두 0건 → 최대 완화 사슬(strict 3+salvage 3+fallback 1=7회)", async () => {
    parseMock.mockResolvedValue({
      intent: {
        ...EMPTY_INTENT,
        titleTokens: ["드라이핏"],
        style: { ...EMPTY_INTENT.style, colors: ["블랙"] },
        sizeStd: [105],
      },
      degraded: false,
    });
    aliasMock.mockResolvedValue([]);
    dbResult.mockReturnValue({ data: [], error: null });

    const { body } = await post("드라이핏 검정 105");
    const b = body as {
      results: unknown[];
      titleTier: string | null;
      titleSalvage: boolean;
      titleDropped: boolean;
    };
    expect(dbResult).toHaveBeenCalledTimes(7); // strict 3 + salvage 3 + fallback 1
    expect(b.results).toEqual([]);
    expect(b.titleSalvage).toBe(true);
    expect(b.titleDropped).toBe(false); // fallback 결과 0건이므로 true 미적용
  });
});

describe("POST /api/search — 결정화 레인(flag-on, P3-F)", () => {
  it("LLM-only 값(색·성별)만 있으면 grounded 신호가 아니라 failed — DB 미조회", async () => {
    vi.stubEnv("SEARCH_DECISIVE_LANE", "on");
    parseMock.mockResolvedValue({
      intent: {
        ...EMPTY_INTENT,
        gender: "남성",
        style: { ...EMPTY_INTENT.style, colors: ["블랙"] },
      },
      degraded: false,
    });
    // 쿼리 토큰 전부 스톱워드 → 제목 토큰(휴리스틱 출처)도 안 생기는 순수 LLM-only 케이스.
    const { body } = await post("그냥 좀 예쁜 티셔츠");
    expect((body as { mode: string }).mode).toBe("failed");
    expect(dbResult).not.toHaveBeenCalled();
  });

  it("명시 가격은 grounded 신호 — LLM 색은 하드에서 빠지고 소프트 칩으로 유지", async () => {
    vi.stubEnv("SEARCH_DECISIVE_LANE", "on");
    parseMock.mockResolvedValue({
      intent: {
        ...EMPTY_INTENT,
        gender: "남성",
        priceMax: 2000, // LLM 오파싱 — 결정적 파서가 20000으로 대체
        style: { ...EMPTY_INTENT.style, colors: ["블랙"] },
        exclude: { ...EMPTY_INTENT.exclude, colors: ["옐로우"] },
      },
      degraded: false,
    });
    const { body } = await post("2만원 이하 검정 반팔");
    const b = body as {
      mode: string;
      intent: {
        style: { colors: string[] };
        gender?: string;
        exclude: { colors: string[] };
      };
    };
    expect(b.mode).toBe("full");
    // 하드 정책: overlaps(색)·eq(gender)·not(배제) 미호출, 가격 lte는 결정적이라 호출.
    expect(dbCalls.some(([m]) => m === "overlaps")).toBe(false);
    expect(dbCalls.some(([m, c]) => m === "eq" && c === "gender")).toBe(false);
    expect(dbCalls.some(([m]) => m === "not")).toBe(false);
    expect(
      dbCalls.some(([m, c, v]) => m === "lte" && c === "price" && v === 20000),
    ).toBe(true);
    // resolved 응답 계약: 소프트 반영된 색은 칩 유지, 미적용 성별·배제는 제거.
    expect(b.intent.style.colors).toEqual(["블랙"]);
    expect(b.intent.gender).toBeUndefined();
    expect(b.intent.exclude.colors).toEqual([]);
  });

  it("title-drop 성공 시 숨긴 titleTokens가 랭킹에도 영향을 주지 않는다", async () => {
    vi.stubEnv("SEARCH_DECISIVE_LANE", "on");
    parseMock.mockResolvedValue({ intent: EMPTY_INTENT, degraded: false });
    aliasMock.mockResolvedValue([]);
    const drops = [
      {
        goods_no: 1,
        title: "베이직 반팔",
        brand: "b",
        review_score: 4,
        review_count: 1,
      },
      {
        goods_no: 2,
        title: "드라이핏 반팔",
        brand: "b",
        review_score: 4,
        review_count: 1,
      },
    ];
    dbResult
      .mockReturnValueOnce({ data: [], error: null }) // phrase
      .mockReturnValueOnce({ data: [], error: null }) // and
      .mockReturnValueOnce({ data: [], error: null }) // or
      .mockReturnValueOnce({ data: drops, error: null }); // titleTokens 폐기 재시도
    const { body } = await post("2만원 이하 드라이핏");
    const b = body as {
      titleDropped: boolean;
      results: { goodsNo: string }[];
      intent: { titleTokens?: string[] };
    };
    expect(b.titleDropped).toBe(true);
    expect(b.intent.titleTokens).toEqual([]);
    // 토큰이 랭킹에 남으면 "드라이핏"(goods_no 2)이 가점으로 1위가 된다 —
    // 폐기된 토큰은 순위에도 무영향이어야 하므로 동점 시 goods_no 오름차순(1위=1).
    expect(b.results[0].goodsNo).toBe("1");
  });

  it("사전 조회 실패(flag-on)도 resolved 응답 계약을 지킨다 — 미적용 LLM 값 미노출", async () => {
    vi.stubEnv("SEARCH_DECISIVE_LANE", "on");
    parseMock.mockResolvedValue({
      intent: {
        ...EMPTY_INTENT,
        gender: "남성",
        style: { ...EMPTY_INTENT.style, colors: ["블랙"] },
      },
      degraded: false,
    });
    aliasMock.mockRejectedValue(new Error("boom"));
    const { body } = await post("2만원 이하 검정 반팔");
    const b = body as {
      mode: string;
      intent: { gender?: string; style: { colors: string[] }; priceMax?: number };
    };
    expect(b.mode).toBe("failed");
    expect(b.intent.gender).toBeUndefined(); // 미적용 LLM 값 제거
    expect(b.intent.style.colors).toEqual(["블랙"]); // 소프트 반영 값은 칩 유지
    expect(b.intent.priceMax).toBe(20000); // 명시 가격(정규식 출처)은 유지
  });

  it("flag 미설정(off)이면 현행 그대로 — LLM 색이 하드필터로 걸린다", async () => {
    parseMock.mockResolvedValue({
      intent: { ...EMPTY_INTENT, style: { ...EMPTY_INTENT.style, colors: ["블랙"] } },
      degraded: false,
    });
    const { body } = await post("검정 반팔");
    expect((body as { mode: string }).mode).toBe("full");
    expect(dbCalls.some(([m, c]) => m === "overlaps" && c === "colors")).toBe(true);
  });
});
