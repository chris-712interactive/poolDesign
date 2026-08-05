import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@pool-design/shared", "@pool-design/db"],
  experimental: {
    externalDir: true,
  },
};

export default nextConfig;
