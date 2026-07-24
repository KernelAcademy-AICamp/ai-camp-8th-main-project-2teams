import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "shopping-phinf.pstatic.net",
      },
    ],
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // CI가 아니면 조용히(로컬 빌드 로그 노이즈 감소). SENTRY_AUTH_TOKEN 없으면 업로드는 자동 스킵.
  silent: !process.env.CI,
  widenClientFileUpload: true,
  // 애드블록 우회용 프록시 라우트.
  tunnelRoute: "/monitoring",
});
