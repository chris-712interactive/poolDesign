import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@pool-design/db";
import {
  DESIGN_LEVEL_CONFIG,
  DESIGN_LEVEL_LABELS,
  emptyDesignDocument,
  type DesignLevel,
} from "@pool-design/shared";
import { getSessionUser } from "@/lib/auth";

async function createProjectAction(formData: FormData) {
  "use server";
  const user = await getSessionUser();
  if (!user?.companyId) redirect("/login");

  const name = String(formData.get("name") || "").trim();
  const clientName = String(formData.get("clientName") || "").trim() || null;
  const address = String(formData.get("address") || "").trim() || null;
  const designLevel = String(formData.get("designLevel") || "residential") as DesignLevel;

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
      address,
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
  redirect(`/app/projects/${project.id}`);
}

export function CreateProjectForm({
  enabledLevels,
}: {
  enabledLevels: DesignLevel[];
}) {
  return (
    <form action={createProjectAction} className="stack">
      <h2>New project</h2>
      <div className="field">
        <label htmlFor="name">Project name</label>
        <input id="name" name="name" required placeholder="Smith Residence Pool" />
      </div>
      <div className="field">
        <label htmlFor="clientName">Client</label>
        <input id="clientName" name="clientName" placeholder="Client name" />
      </div>
      <div className="field">
        <label htmlFor="address">Address</label>
        <input id="address" name="address" placeholder="Job site address" />
      </div>
      <div className="field">
        <label htmlFor="designLevel">Design level</label>
        <select id="designLevel" name="designLevel" defaultValue="residential">
          {enabledLevels.map((level) => (
            <option key={level} value={level}>
              {DESIGN_LEVEL_LABELS[level]}
            </option>
          ))}
        </select>
      </div>
      <button className="btn" type="submit">
        Create project
      </button>
    </form>
  );
}
