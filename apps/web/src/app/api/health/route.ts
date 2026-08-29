import { NextResponse } from "next/server";
import { prisma } from "@pool-design/db";

function isProduction() {
  return process.env.NODE_ENV === "production";
}

/** Public health check — use this to verify DB connectivity on Vercel. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    if (isProduction()) {
      return NextResponse.json({ ok: true });
    }
    const users = await prisma.user.count();
    const companies = await prisma.company.count();
    return NextResponse.json({
      ok: true,
      database: "connected",
      users,
      companies,
      hint:
        users === 0
          ? "Database is empty — run DATABASE_URL=... pnpm db:push && pnpm db:seed"
          : undefined,
    });
  } catch (err) {
    console.error("health check failed", err);
    if (isProduction()) {
      return NextResponse.json({ ok: false }, { status: 500 });
    }
    return NextResponse.json(
      {
        ok: false,
        database: "error",
        message: err instanceof Error ? err.message : "Unknown database error",
        hint: "Set DATABASE_URL (Neon pooled + sslmode=require), then pnpm db:push && pnpm db:seed",
      },
      { status: 500 },
    );
  }
}
