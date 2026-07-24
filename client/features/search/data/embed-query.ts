// 서버 전용: 사용자 쿼리를 NVIDIA 임베딩 API로 벡터화(input_type=query). 상품과 동일 모델.
const BASE_URL = process.env.NVIDIA_BASE_URL ?? "https://integrate.api.nvidia.com/v1";
const MODEL = process.env.NVIDIA_EMBED_MODEL ?? "baai/bge-m3";

function firstEmbedding(payload: unknown): number[] | null {
  if (typeof payload !== "object" || payload === null) return null;
  const data = (payload as Record<string, unknown>).data;
  if (!Array.isArray(data) || data.length === 0) return null;
  const first: unknown = data[0];
  if (typeof first !== "object" || first === null) return null;
  const emb = (first as Record<string, unknown>).embedding;
  return Array.isArray(emb) && emb.every((n) => typeof n === "number") ? emb : null;
}

export async function embedQuery(
  text: string,
  fetchFn: typeof fetch = fetch,
): Promise<number[] | null> {
  const trimmed = text.trim();
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!trimmed || !apiKey) return null;
  try {
    const res = await fetchFn(`${BASE_URL}/embeddings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        input: [trimmed],
        input_type: "query",
        truncate: "END",
      }),
    });
    if (!res.ok) return null;
    return firstEmbedding(await res.json());
  } catch {
    return null;
  }
}
