"use client";

import { useEffect, useRef } from "react";

/* 모바일·데이터 절약·모션 최소화 환경에서는 4.6MB 영상을 받지 않고
   포스터만 보여준다. 허용 환경에서만 src를 붙여 재생을 시작한다. */
export default function HeroVideo() {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
    const blocked =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      window.matchMedia("(max-width: 40rem)").matches ||
      (nav.connection?.saveData ?? false);

    if (!blocked) {
      video.src = "/hero-loop.mp4";
    }
  }, []);

  return (
    <video
      ref={ref}
      className="tf-home__video"
      poster="/hero-poster.jpg"
      preload="none"
      autoPlay
      muted
      loop
      playsInline
      aria-hidden="true"
    />
  );
}
