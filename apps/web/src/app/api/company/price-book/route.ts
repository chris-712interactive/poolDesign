import { NextResponse } from "next/server";
import { prisma } from "@pool-design/db";
import { catalogForLevel, type DesignLevel } from "@pool-design/shared";
import { getSessionUser } from "@/lib/auth";
import { completeMilestone } from "@/lib/shares";
import { companyHasAppAccess } from "@/lib/subscription";

/** List catalog + company overrides (residential default for pilots). */
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user?.companyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const level = (new URL(request.url).searchParams.get("level") ||
    "residential") as DesignLevel;
  const catalog = catalogForLevel(level);
  const overrides = await prisma.companyPriceOverride.findMany({
    where: { companyId: user.companyId },
  });
  const map = new Map(overrides.map((o) => [o.catalogItemId, o.unitPriceCents]));

  return NextResponse.json({
    items: catalog.map((item) => ({
      ...item,
      defaultUnitPriceCents: item.unitPriceCents,
      unitPriceCents: map.get(item.id) ?? item.unitPriceCents,
      overridden: map.has(item.id),
    })),
  });
}

/** Upsert overrides or accept defaults (clears overrides + completes milestone). */
export async function PUT(request: Request) {
  const user = await getSessionUser();
  if (!user?.companyId || user.role !== "company_admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!companyHasAppAccess(user.company)) {
    return NextResponse.json({ error: "Subscription inactive" }, { status: 402 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    acceptDefaults?: boolean;
    overrides?: Array<{ catalogItemId: string; unitPriceCents: number }>;
  };

  if (body.acceptDefaults) {
    await prisma.companyPriceOverride.deleteMany({
      where: { companyId: user.companyId },
    });
    await completeMilestone(user.companyId, "price_book", "Accepted catalog defaults");
    return NextResponse.json({ ok: true, acceptedDefaults: true });
  }

  const overrides = body.overrides ?? [];
  for (const row of overrides) {
    if (!row.catalogItemId || !Number.isFinite(row.unitPriceCents)) continue;
    const cents = Math.max(0, Math.round(row.unitPriceCents));
    await prisma.companyPriceOverride.upsert({
      where: {
        companyId_catalogItemId: {
          companyId: user.companyId,
          catalogItemId: row.catalogItemId,
        },
      },
      create: {
        companyId: user.companyId,
        catalogItemId: row.catalogItemId,
        unitPriceCents: cents,
      },
      update: { unitPriceCents: cents },
    });
  }

  await completeMilestone(user.companyId, "price_book");
  return NextResponse.json({ ok: true, count: overrides.length });
}
