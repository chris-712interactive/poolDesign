import { PrismaClient } from "../src/generated/client";
import bcrypt from "bcryptjs";
import {
  DEFAULT_ONBOARDING_MILESTONES,
  DESIGN_LEVEL_CONFIG,
  emptyDesignDocument,
} from "@pool-design/shared";

const prisma = new PrismaClient();

async function main() {
  for (const m of DEFAULT_ONBOARDING_MILESTONES) {
    await prisma.onboardingMilestone.upsert({
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

  const passwordHash = await bcrypt.hash("password123", 10);

  // Migrate legacy demo owner email if present
  await prisma.user.updateMany({
    where: { email: "owner@pooldesign.app" },
    data: { email: "owner@poolshape.com" },
  });

  await prisma.user.upsert({
    where: { email: "owner@poolshape.com" },
    create: {
      email: "owner@poolshape.com",
      name: "Platform Owner",
      passwordHash,
      role: "platform_owner",
      unitSystem: "imperial",
    },
    update: { passwordHash, name: "Platform Owner" },
  });

  const company = await prisma.company.upsert({
    where: { slug: "acme-pools" },
    create: {
      name: "Acme Pools",
      slug: "acme-pools",
      defaultUnitSystem: "imperial",
      region: "Southwest US",
      subscriptionStatus: "trialing",
      planKey: "pro",
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      setupCompletedAt: new Date(),
    },
    update: {
      name: "Acme Pools",
      subscriptionStatus: "trialing",
      setupCompletedAt: new Date(),
    },
  });

  const milestones = await prisma.onboardingMilestone.findMany({
    orderBy: { sortOrder: "asc" },
  });

  for (const milestone of milestones) {
    const completedEarly = ["account_created", "subdomain_live", "admin_logged_in"].includes(
      milestone.key,
    );
    await prisma.companyMilestoneStatus.upsert({
      where: {
        companyId_milestoneId: {
          companyId: company.id,
          milestoneId: milestone.id,
        },
      },
      create: {
        companyId: company.id,
        milestoneId: milestone.id,
        state: completedEarly ? "completed" : "pending",
        source: completedEarly ? "system" : null,
        completedAt: completedEarly ? new Date() : null,
      },
      update: {},
    });
  }

  await prisma.user.upsert({
    where: { email: "admin@acme-pools.test" },
    create: {
      email: "admin@acme-pools.test",
      name: "Alex Admin",
      passwordHash,
      role: "company_admin",
      alsoDesigner: true,
      companyId: company.id,
      unitSystem: "imperial",
    },
    update: { passwordHash, companyId: company.id, alsoDesigner: true },
  });

  await prisma.user.upsert({
    where: { email: "designer@acme-pools.test" },
    create: {
      email: "designer@acme-pools.test",
      name: "Dana Designer",
      passwordHash,
      role: "designer",
      companyId: company.id,
      unitSystem: "imperial",
    },
    update: { passwordHash, companyId: company.id },
  });

  const design = emptyDesignDocument(
    "residential",
    "imperial",
    DESIGN_LEVEL_CONFIG.residential.defaultLayers,
  );

  const existing = await prisma.project.findFirst({
    where: { companyId: company.id, name: "Kendig Residence Pool" },
  });

  if (!existing) {
    await prisma.project.create({
      data: {
        companyId: company.id,
        name: "Kendig Residence Pool",
        clientName: "Chris Kendig",
        address: "123 Palm Ave",
        designLevel: "residential",
        unitSystem: "imperial",
        designJson: JSON.stringify(design),
      },
    });
  }

  console.log("Seed complete.");
  console.log("  owner@poolshape.com / password123");
  console.log("  admin@acme-pools.test / password123");
  console.log("  designer@acme-pools.test / password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
