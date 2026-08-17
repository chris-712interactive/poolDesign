"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@pool-design/db";
import {
  DESIGN_LEVEL_CONFIG,
  emptyDesignDocument,
  formatAddressLine,
  normalizeAddress,
  type DesignLevel,
} from "@pool-design/shared";
import { getSessionUser } from "@/lib/auth";
import { companyHasAppAccess } from "@/lib/subscription";

export async function createProjectAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user?.companyId) redirect("/login");
  if (!companyHasAppAccess(user.company)) redirect("/app/admin");

  const name = String(formData.get("name") || "").trim();
  const clientName = String(formData.get("clientName") || "").trim() || null;
  const phone = String(formData.get("phone") || "").trim() || null;
  const designLevel = String(
    formData.get("designLevel") || "residential",
  ) as DesignLevel;
  const site = normalizeAddress({
    street: String(formData.get("jobStreet") || ""),
    city: String(formData.get("jobCity") || ""),
    state: String(formData.get("jobState") || ""),
    postalCode: String(formData.get("jobPostal") || ""),
    country: String(formData.get("jobCountry") || ""),
  });

  if (!name) redirect("/app");

  const company = await prisma.company.findUniqueOrThrow({
    where: { id: user.companyId },
  });
  const enabled = company.enabledDesignLevels.split(",");
  if (!enabled.includes(designLevel)) {
    redirect("/app");
  }

  const design = emptyDesignDocument(
    designLevel,
    user.unitSystem,
    DESIGN_LEVEL_CONFIG[designLevel].defaultLayers,
  );

  const project = await prisma.project.create({
    data: {
      companyId: user.companyId,
      name,
      clientName,
      phone,
      address: formatAddressLine(site),
      street: site.street,
      city: site.city,
      state: site.state,
      postalCode: site.postalCode,
      country: site.country,
      designLevel,
      unitSystem: user.unitSystem,
      designJson: JSON.stringify(design),
    },
  });

  const firstProjectMilestone = await prisma.onboardingMilestone.findUnique({
    where: { key: "first_project" },
  });
  if (firstProjectMilestone) {
    await prisma.companyMilestoneStatus.updateMany({
      where: {
        companyId: user.companyId,
        milestoneId: firstProjectMilestone.id,
        state: { in: ["pending", "in_progress"] },
      },
      data: {
        state: "completed",
        source: "system",
        completedAt: new Date(),
      },
    });
  }

  revalidatePath("/app");
  redirect(`/app/projects/${project.id}?survey=1`);
}
