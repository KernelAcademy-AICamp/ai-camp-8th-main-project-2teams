import { describe, expect, it } from "vitest";

import type { Intent } from "@/features/search/domain/intent";
import {
  deriveResultType,
  entryTypeFromSrc,
  flattenParsedAttributes,
  hasParsedConstraint,
} from "@/shared/analytics-params";

const empty: Intent = { functional: [] };

describe("deriveResultType", () => {
  it("exact가 있으면 exact", () => {
    expect(deriveResultType({ exact: [{}], partial: [] } as never)).toBe("exact");
  });
  it("exact 없고 partial 있으면 partial", () => {
    expect(deriveResultType({ exact: [], partial: [{}] } as never)).toBe("partial");
  });
  it("둘 다 없으면 none", () => {
    expect(deriveResultType({ exact: [], partial: [] })).toBe("none");
  });
});

describe("flattenParsedAttributes", () => {
  it("값 있는 속성만 parsed_* 로 펼친다", () => {
    const intent: Intent = {
      functional: ["쿨링"],
      baseColor: "블랙",
      printPosition: "앞",
    } as never;
    expect(flattenParsedAttributes(intent)).toEqual({
      parsed_base_color: "블랙",
      parsed_print_position: "앞",
      parsed_functional: "쿨링",
    });
  });
  it("빈 intent는 빈 객체", () => {
    expect(flattenParsedAttributes(empty)).toEqual({});
  });
});

describe("hasParsedConstraint", () => {
  it("아무 조건 없으면 false", () => {
    expect(hasParsedConstraint(empty)).toBe(false);
  });
  it("한 속성이라도 있으면 true", () => {
    expect(hasParsedConstraint({ functional: [], fit: "오버" } as never)).toBe(true);
  });
});

describe("entryTypeFromSrc", () => {
  it("typed 마커", () => {
    expect(entryTypeFromSrc("typed")).toBe("typed");
  });
  it("chip 마커", () => {
    expect(entryTypeFromSrc("chip")).toBe("example_chip");
  });
  it("마커 없으면 direct", () => {
    expect(entryTypeFromSrc(null)).toBe("direct");
  });
  it("refine 등 기타는 typed로 간주하지 않고 direct", () => {
    expect(entryTypeFromSrc("refine")).toBe("direct");
  });
});
