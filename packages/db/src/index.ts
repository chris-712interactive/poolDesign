import { PrismaClient } from "./generated/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is required (Postgres). See .env.example and docs/deploy.md",
    );
  }
  if (url.startsWith("file:")) {
    throw new Error(
      "SQLite file URLs are no longer supported. Use Postgres (Neon / local Docker). See docs/deploy.md",
    );
  }
  return url;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: databaseUrl() } },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export * from "./generated/client";
export { ensureOnboardingMilestoneCatalog } from "./milestones";
