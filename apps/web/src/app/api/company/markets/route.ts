import { NextResponse } from "next/server";
import { prisma } from "@pool-design/db";
import { rollupJobMarkets } from "@pool-design/shared";
import { getSessionUser } from "@/lib/auth";

/** Job counts by state and city for the signed-in company. */
export async function GET() {
  const user = await getSessionUser();
  if (!user?.companyId || user.role !== "company_admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const jobs = await prisma.project.findMany({
    where: { companyId: user.companyId },
    select: { city: true, state: true },
  });

  return NextResponse.json(rollupJobMarkets(jobs));
}
