"use client";

import { useEffect, useRef } from "react";

/* 모바일·데이터 절약·모션 최소화 환경에서는 4.6MB 영상을 받지 않고
   포스터만 보여준다. 마운트 후 환경이 바뀌어도(reduced-motion 토글,
   가로폭 변경) 다시 판정한다. */
export default function HeroVideo() {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const narrow = window.matchMedia("(max-width: 40rem)");
    const nav = navigator as Navigator & { connection?: { saveData?: boolean } };

    const apply = () => {
      const blocked =
        reduceMotion.matches || narrow.matches || (nav.connection?.saveData ?? false);
      if (blocked) {
        if (video.getAttribute("src")) {
          video.pause();
          video.removeAttribute("src"); // 영상 다운로드 자체를 건너뛰고 포스터만 유지
          video.load();
        }
      } else if (!video.getAttribute("src")) {
        video.src = "/hero-loop.mp4";
      }
    };

    apply();
    reduceMotion.addEventListener("change", apply);
    narrow.addEventListener("change", apply);
    return () => {
      reduceMotion.removeEventListener("change", apply);
      narrow.removeEventListener("change", apply);
    };
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
