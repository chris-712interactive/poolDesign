import { NextResponse } from "next/server";
import { prisma } from "@pool-design/db";

export async function GET() {
  try {
    const users = await prisma.user.count();
    const companies = await prisma.company.count();
    return NextResponse.json({ ok: true, users, companies });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "unknown",
        databaseUrl: process.env.DATABASE_URL,
      },
      { status: 500 },
    );
  }
}
