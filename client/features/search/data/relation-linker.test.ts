// linkRelations 데이터 계층 테스트 — 실제 네트워크 호출 금지, fetchFn을 항상 mock 주입한다.
import { describe, expect, it, vi } from "vitest";

import { buildQueryFrame } from "../domain/query-frame";
import { linkRelations } from "./relation-linker";

const frame = () => buildQueryFrame("검은색이나 하얀색 무늬가 있는 빨간색 티셔츠");
const okResponse = (obj: unknown) =>
  ({
    ok: true,
    json: () =>
      Promise.resolve({ choices: [{ message: { content: JSON.stringify(obj) } }] }),
  }) as never;

describe("linkRelations", () => {
  it("LLM JSON을 파싱해 LinkerProposal 반환", async () => {
    process.env.NVIDIA_API_KEY = "k";
    const proposal = {
      clauses: [
        {
          base: { refs: ["m03"], operator: "single" },
          print: { refs: ["m01", "m02"], operator: "anyOf", operatorRef: "o01" },
          placement: { refs: [], operator: "single" },
          graphic: { refs: [], operator: "single" },
          anchorRefs: ["a01"],
        },
      ],
      alternatives: [{ clauseIndexes: [0] }],
      external: [],
      newMentions: [],
    };
    const fetchMock = vi.fn().mockResolvedValue(okResponse(proposal));
    const r = await linkRelations(frame(), fetchMock as typeof fetch);
    expect(r?.proposal.clauses[0].print.refs).toEqual(["m01", "m02"]);
  });

  it("실패(비ok·파싱불가)는 null", async () => {
    process.env.NVIDIA_API_KEY = "k";
    const fetchMock = vi.fn().mockResolvedValue({ ok: false });
    expect(await linkRelations(frame(), fetchMock as typeof fetch)).toBeNull();
  });

  it("API 키 없으면 fetch 호출 없이 null", async () => {
    delete process.env.NVIDIA_API_KEY;
    const fetchMock = vi.fn();
    expect(await linkRelations(frame(), fetchMock as typeof fetch)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("mention이 없으면 fetch 호출 없이 null", async () => {
    process.env.NVIDIA_API_KEY = "k";
    const fetchMock = vi.fn();
    const emptyFrame = buildQueryFrame("아무 색도 없는 문장");
    expect(await linkRelations(emptyFrame, fetchMock as typeof fetch)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
