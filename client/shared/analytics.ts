// 공용: 분석 이벤트 계측 seam. Loop 2에서 Amplitude로 연동한다. 지금은 no-op.
export function track(event: string, props?: Record<string, unknown>): void {
  // TODO(Loop2): amplitude.track(event, props)
  void event;
  void props;
}
