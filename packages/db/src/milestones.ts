import { DEFAULT_ONBOARDING_MILESTONES } from "@pool-design/shared";
import type { PrismaClient } from "./generated/client";

type MilestoneDb = Pick<PrismaClient, "onboardingMilestone">;

/** Upsert the platform milestone catalog. Safe to run on every deploy / signup. */
export async function ensureOnboardingMilestoneCatalog(
  db: MilestoneDb,
): Promise<void> {
  const retired = [
    "first_contract_signed",
    "first_payment_recorded",
    "offline_sync",
  ];
  await db.onboardingMilestone.deleteMany({
    where: { key: { in: retired } },
  });

  for (const m of DEFAULT_ONBOARDING_MILESTONES) {
    await db.onboardingMilestone.upsert({
      where: { key: m.key },
      create: {
        key: m.key,
        title: m.title,
        description: m.description,
        sortOrder: m.sortOrder,
      },
      update: {
        title: m.title,
        description: m.description,
        sortOrder: m.sortOrder,
      },
    });
  }
}
