import { PrismaClient } from "../src/generated/client";
import bcrypt from "bcryptjs";
import {
  DESIGN_LEVEL_CONFIG,
  emptyDesignDocument,
} from "@pool-design/shared";
import { ensureOnboardingMilestoneCatalog } from "../src/milestones";

const prisma = new PrismaClient();

function allowDemoSeed(): boolean {
  if (process.env.SEED_DEMO === "1") return true;
  if (process.env.SEED_DEMO === "0") return false;
  return process.env.NODE_ENV !== "production";
}

function resetDemoPasswords(): boolean {
  return process.env.SEED_RESET_DEMO_PASSWORDS === "1";
}

async function main() {
  await ensureOnboardingMilestoneCatalog(prisma);

  if (!allowDemoSeed()) {
    console.log(
      "Seed complete (milestone catalog only). Demo users were skipped — set SEED_DEMO=1 to load Acme Pools.",
    );
    return;
  }

  const passwordHash = await bcrypt.hash("password123", 10);
  const overwritePassword = resetDemoPasswords();

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
    update: {
      name: "Platform Owner",
      ...(overwritePassword ? { passwordHash } : {}),
    },
  });

  const company = await prisma.company.upsert({
    where: { slug: "acme-pools" },
    create: {
      name: "Acme Pools",
      slug: "acme-pools",
      defaultUnitSystem: "imperial",
      region: "Southwest US",
      street: "4100 Desert Bloom Rd",
      city: "Scottsdale",
      state: "AZ",
      postalCode: "85251",
      country: "US",
      subscriptionStatus: "trialing",
      planKey: "pro",
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      setupCompletedAt: new Date(),
      designerSeatsPaid: 1,
    },
    update: {
      name: "Acme Pools",
      region: "Southwest US",
      street: "4100 Desert Bloom Rd",
      city: "Scottsdale",
      state: "AZ",
      postalCode: "85251",
      country: "US",
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

  const admin = await prisma.user.upsert({
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
    update: {
      companyId: company.id,
      alsoDesigner: true,
      ...(overwritePassword ? { passwordHash } : {}),
    },
  });
  await prisma.userRoleGrant.deleteMany({ where: { userId: admin.id } });
  await prisma.userRoleGrant.createMany({
    data: [
      { userId: admin.id, companyId: company.id, role: "company_admin" },
      { userId: admin.id, companyId: company.id, role: "designer" },
    ],
  });

  const designer = await prisma.user.upsert({
    where: { email: "designer@acme-pools.test" },
    create: {
      email: "designer@acme-pools.test",
      name: "Dana Designer",
      passwordHash,
      role: "designer",
      companyId: company.id,
      unitSystem: "imperial",
    },
    update: {
      companyId: company.id,
      ...(overwritePassword ? { passwordHash } : {}),
    },
  });
  await prisma.userRoleGrant.deleteMany({ where: { userId: designer.id } });
  await prisma.userRoleGrant.createMany({
    data: [{ userId: designer.id, companyId: company.id, role: "designer" }],
  });

  const design = emptyDesignDocument(
    "residential",
    "imperial",
    DESIGN_LEVEL_CONFIG.residential.defaultLayers,
  );

  const existing = await prisma.project.findFirst({
    where: { companyId: company.id, name: "Kendig Residence Pool" },
  });

  const site = {
    clientName: "Chris Kendig",
    phone: "407-555-0142",
    address: "123 Palm Ave, Tampa, FL 33602",
    street: "123 Palm Ave",
    city: "Tampa",
    state: "FL",
    postalCode: "33602",
    country: "US",
  };

  if (!existing) {
    await prisma.project.create({
      data: {
        companyId: company.id,
        name: "Kendig Residence Pool",
        ...site,
        designLevel: "residential",
        unitSystem: "imperial",
        designJson: JSON.stringify(design),
      },
    });
  } else {
    await prisma.project.update({
      where: { id: existing.id },
      data: site,
    });
  }

  console.log("Seed complete.");
  console.log("  owner@poolshape.com / password123");
  console.log("  admin@acme-pools.test / password123");
  console.log("  designer@acme-pools.test / password123");
  if (!overwritePassword) {
    console.log(
      "  Existing demo passwords were left unchanged. Set SEED_RESET_DEMO_PASSWORDS=1 to reset them.",
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
