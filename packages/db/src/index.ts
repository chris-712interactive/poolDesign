import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

/** Prisma SQLite URLs are fragile across cwd; pin to packages/db/prisma/dev.db */
function resolveDatabaseUrl(): string {
  const existing = process.env.DATABASE_URL;
  if (existing?.startsWith("file:") && !existing.includes("..") && existing.endsWith("prisma/dev.db")) {
    return existing;
  }

  const here = path.dirname(fileURLToPath(import.meta.url));
  const dbFile = path.join(here, "..", "prisma", "dev.db");
  return `file:${dbFile}`;
}

process.env.DATABASE_URL = resolveDatabaseUrl();

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL } },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export * from "@prisma/client";
