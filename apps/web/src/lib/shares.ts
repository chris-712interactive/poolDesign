import { randomBytes } from "crypto";
import { catalogForLevel, type CatalogItem } from "@pool-design/shared";
import type { DesignLevel } from "@pool-design/shared";
import { prisma } from "@pool-design/db";

export function newShareToken(): string {
  return randomBytes(24).toString("base64url");
}

export function newInviteToken(): string {
  return randomBytes(18).toString("base64url");
}

/** Catalog with company unit-price overrides applied. */
export async function catalogWithCompanyPrices(
  companyId: string,
  designLevel: DesignLevel,
): Promise<CatalogItem[]> {
  const base = catalogForLevel(designLevel);
  const overrides = await prisma.companyPriceOverride.findMany({
    where: { companyId },
  });
  if (!overrides.length) return base;
  const map = new Map(overrides.map((o) => [o.catalogItemId, o.unitPriceCents]));
  return base.map((item) => {
    const cents = map.get(item.id);
    return cents != null ? { ...item, unitPriceCents: cents } : item;
  });
}

export async function completeMilestone(
  companyId: string,
  key: string,
  note?: string,
) {
  const milestone = await prisma.onboardingMilestone.findUnique({
    where: { key },
  });
  if (!milestone) return;
  await prisma.companyMilestoneStatus.updateMany({
    where: {
      companyId,
      milestoneId: milestone.id,
      state: { in: ["pending", "in_progress"] },
    },
    data: {
      state: "completed",
      source: "system",
      note: note ?? null,
      completedAt: new Date(),
    },
  });
}
