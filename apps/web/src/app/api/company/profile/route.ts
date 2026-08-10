import { NextResponse } from "next/server";
import { prisma } from "@pool-design/db";
import { getSessionUser } from "@/lib/auth";
import { completeMilestone } from "@/lib/shares";
import { companyHasAppAccess } from "@/lib/subscription";

/** Update company profile (admin). */
export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user?.companyId || user.role !== "company_admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!companyHasAppAccess(user.company)) {
    return NextResponse.json({ error: "Subscription inactive" }, { status: 402 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    logoUrl?: string | null;
    region?: string | null;
    defaultUnitSystem?: "imperial" | "metric";
  };

  const data: {
    name?: string;
    logoUrl?: string | null;
    region?: string | null;
    defaultUnitSystem?: "imperial" | "metric";
  } = {};

  if (typeof body.name === "string" && body.name.trim()) {
    data.name = body.name.trim();
  }
  if (body.logoUrl !== undefined) {
    data.logoUrl = body.logoUrl?.trim() || null;
  }
  if (body.region !== undefined) {
    data.region = body.region?.trim() || null;
  }
  if (body.defaultUnitSystem === "imperial" || body.defaultUnitSystem === "metric") {
    data.defaultUnitSystem = body.defaultUnitSystem;
  }

  const company = await prisma.company.update({
    where: { id: user.companyId },
    data,
  });

  if (company.name && company.region && company.defaultUnitSystem) {
    await completeMilestone(user.companyId, "company_profile");
  }

  return NextResponse.json({
    id: company.id,
    name: company.name,
    logoUrl: company.logoUrl,
    region: company.region,
    defaultUnitSystem: company.defaultUnitSystem,
    slug: company.slug,
  });
}
