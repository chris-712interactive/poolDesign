import { NextResponse } from "next/server";
import { prisma } from "@pool-design/db";
import {
  applyPriceBookCsv,
  catalogForLevel,
  priceBookToCsv,
  type DesignLevel,
} from "@pool-design/shared";
import { getSessionUser } from "@/lib/auth";
import { completeMilestone } from "@/lib/shares";
import { companyHasAppAccess } from "@/lib/subscription";

function levelFromRequest(request: Request, fallback: DesignLevel = "residential"): DesignLevel {
  const raw = new URL(request.url).searchParams.get("level") || fallback;
  return raw === "commercial" || raw === "water_park" ? raw : "residential";
}

async function priceBookItems(companyId: string, level: DesignLevel) {
  const catalog = catalogForLevel(level);
  const overrides = await prisma.companyPriceOverride.findMany({
    where: { companyId },
  });
  const map = new Map(overrides.map((o) => [o.catalogItemId, o.unitPriceCents]));
  return catalog.map((item) => ({
    ...item,
    defaultUnitPriceCents: item.unitPriceCents,
    unitPriceCents: map.get(item.id) ?? item.unitPriceCents,
    overridden: map.has(item.id),
  }));
}

async function upsertOverrides(
  companyId: string,
  rows: Array<{ catalogItemId: string; unitPriceCents: number }>,
) {
  for (const row of rows) {
    if (!row.catalogItemId || !Number.isFinite(row.unitPriceCents)) continue;
    const cents = Math.max(0, Math.round(row.unitPriceCents));
    await prisma.companyPriceOverride.upsert({
      where: {
        companyId_catalogItemId: {
          companyId,
          catalogItemId: row.catalogItemId,
        },
      },
      create: {
        companyId,
        catalogItemId: row.catalogItemId,
        unitPriceCents: cents,
      },
      update: { unitPriceCents: cents },
    });
  }
}

/** List catalog + company overrides (residential default for pilots). */
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user?.companyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const level = levelFromRequest(request);
  const items = await priceBookItems(user.companyId, level);
  const format = new URL(request.url).searchParams.get("format");
  if (format === "csv") {
    const csv = priceBookToCsv(
      items.map((item) => ({
        catalogItemId: item.id,
        name: item.name,
        unit: item.unit,
        unitPriceCents: item.unitPriceCents,
        overridden: item.overridden,
      })),
    );
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="price-book-${level}.csv"`,
      },
    });
  }

  return NextResponse.json({ items });
}

/** Upsert overrides, accept defaults, or import CSV. */
export async function PUT(request: Request) {
  const user = await getSessionUser();
  if (!user?.companyId || user.role !== "company_admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!companyHasAppAccess(user.company)) {
    return NextResponse.json({ error: "Subscription inactive" }, { status: 402 });
  }

  const level = levelFromRequest(request);
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("text/csv")) {
    const csv = await request.text();
    return importCsv(user.companyId, csv, level);
  }

  const body = (await request.json().catch(() => ({}))) as {
    acceptDefaults?: boolean;
    csv?: string;
    overrides?: Array<{ catalogItemId: string; unitPriceCents: number }>;
  };

  if (typeof body.csv === "string") {
    return importCsv(user.companyId, body.csv, level);
  }

  if (body.acceptDefaults) {
    await prisma.companyPriceOverride.deleteMany({
      where: { companyId: user.companyId },
    });
    await completeMilestone(user.companyId, "price_book", "Accepted catalog defaults");
    return NextResponse.json({ ok: true, acceptedDefaults: true });
  }

  const overrides = body.overrides ?? [];
  await upsertOverrides(user.companyId, overrides);
  await completeMilestone(user.companyId, "price_book");
  return NextResponse.json({ ok: true, count: overrides.length });
}

async function importCsv(companyId: string, csv: string, level: DesignLevel) {
  const catalog = catalogForLevel(level);
  const applied = applyPriceBookCsv(csv, catalog);
  await upsertOverrides(companyId, applied.upserts);
  if (applied.clears.length > 0) {
    await prisma.companyPriceOverride.deleteMany({
      where: {
        companyId,
        catalogItemId: { in: applied.clears },
      },
    });
  }
  await completeMilestone(companyId, "price_book");
  const items = await priceBookItems(companyId, level);
  return NextResponse.json({
    ok: true,
    count: applied.upserts.length,
    cleared: applied.clears.length,
    skipped: applied.skipped,
    items,
  });
}
