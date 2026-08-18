import { NextResponse } from "next/server";
import { prisma } from "@pool-design/db";
import {
  defaultEstimateRecipe,
  parseEstimateRecipe,
  serializeEstimateRecipe,
  type DesignLevel,
  type EstimateRecipe,
} from "@pool-design/shared";
import { getSessionUser } from "@/lib/auth";
import { catalogWithCompanyPrices } from "@/lib/shares";
import { companyHasAppAccess, requireEntitlement } from "@/lib/subscription";

function withCatalogPrices(
  recipe: EstimateRecipe,
  catalog: Awaited<ReturnType<typeof catalogWithCompanyPrices>>,
): EstimateRecipe {
  const map = new Map(catalog.map((c) => [c.id, c.unitPriceCents]));
  return {
    version: 1,
    lines: recipe.lines.map((line) => {
      if (!line.catalogItemId) return line;
      const cents = map.get(line.catalogItemId);
      return cents == null ? line : { ...line, unitPriceCents: cents };
    }),
  };
}

/** Company estimate recipe (Builder). */
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user?.companyId || !user.company) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!companyHasAppAccess(user.company)) {
    return NextResponse.json({ error: "Subscription inactive" }, { status: 402 });
  }

  const level = (new URL(request.url).searchParams.get("level") ||
    "residential") as DesignLevel;
  const catalog = await catalogWithCompanyPrices(user.companyId, level);
  const row = await prisma.company.findUnique({
    where: { id: user.companyId },
    select: { estimateRecipeJson: true },
  });
  const saved = parseEstimateRecipe(row?.estimateRecipeJson);
  if (saved) {
    return NextResponse.json({ recipe: saved, isDefault: false });
  }
  return NextResponse.json({
    recipe: withCatalogPrices(defaultEstimateRecipe(level, catalog), catalog),
    isDefault: true,
  });
}

export async function PUT(request: Request) {
  const user = await getSessionUser();
  if (!user?.companyId || !user.company || user.role !== "company_admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const gate = requireEntitlement(user.company, "estimateRecipe");
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const body = (await request.json().catch(() => ({}))) as {
    reset?: boolean;
    recipe?: unknown;
  };

  if (body.reset) {
    await prisma.company.update({
      where: { id: user.companyId },
      data: { estimateRecipeJson: null },
    });
    return NextResponse.json({ ok: true, reset: true });
  }

  const parsed = parseEstimateRecipe(
    JSON.stringify({ version: 1, lines: (body.recipe as EstimateRecipe | undefined)?.lines ?? [] }),
  );
  if (!parsed) {
    return NextResponse.json({ error: "Invalid recipe" }, { status: 400 });
  }

  await prisma.company.update({
    where: { id: user.companyId },
    data: { estimateRecipeJson: serializeEstimateRecipe(parsed) },
  });
  return NextResponse.json({ ok: true, recipe: parsed });
}