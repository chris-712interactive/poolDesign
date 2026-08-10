import type { NextConfig } from "next";
import path from "path";
import { PrismaPlugin } from "@prisma/nextjs-monorepo-workaround-plugin";

const nextConfig: NextConfig = {
  transpilePackages: ["@pool-design/shared", "@pool-design/db"],
  // Keep Prisma out of the webpack/turbopack bundle so the query engine loads on Vercel.
  serverExternalPackages: ["@prisma/client", "prisma"],
  // Monorepo root — required so file tracing can reach packages/db generated engines.
  outputFileTracingRoot: path.join(__dirname, "../.."),
  outputFileTracingIncludes: {
    "/**": [
      "./../../packages/db/src/generated/client/**/*",
      "./../../node_modules/.pnpm/@prisma+client@*/node_modules/.prisma/client/**",
    ],
  },
  experimental: {
    externalDir: true,
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.plugins = [...config.plugins, new PrismaPlugin()];
    }
    return config;
  },
};

export default nextConfig;
