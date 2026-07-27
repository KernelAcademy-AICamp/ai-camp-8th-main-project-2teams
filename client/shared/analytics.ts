// 공용: 분석 이벤트 계측 seam. GA4(gtag)로 연동. dev에선 gtag가 없으므로 콘솔로만 관측.
declare global {
  interface Window {
    gtag?: (
      command: "event",
      eventName: string,
      params?: Record<string, unknown>,
    ) => void;
  }
}

export function track(event: string, props?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console -- dev 전용 관측 seam(프로덕션은 gtag 사용)
    console.debug("[track]", event, props ?? {});
  }
  window.gtag?.("event", event, props);
}

// 검색 1건당 고유 id — 퍼널 조인 키. 신규 의존성 없이 Web Crypto 사용.
export function newSearchId(): string {
  return crypto.randomUUID();
}
