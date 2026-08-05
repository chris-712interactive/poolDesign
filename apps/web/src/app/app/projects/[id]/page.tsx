import { notFound, redirect } from "next/navigation";
import { prisma } from "@pool-design/db";
import {
  emptyDesignDocument,
  DESIGN_LEVEL_CONFIG,
  type DesignDocument,
  type DesignLevel,
} from "@pool-design/shared";
import { getSessionUser } from "@/lib/auth";
import { AppHeader } from "@/components/AppHeader";
import { CadWorkspace } from "@/components/CadWorkspace";

function parseDesign(
  json: string,
  designLevel: DesignLevel,
  unitSystem: "imperial" | "metric",
): DesignDocument {
  try {
    const parsed = JSON.parse(json) as DesignDocument;
    if (parsed?.version === 1 && Array.isArray(parsed.plumbingRuns)) {
      return {
        ...parsed,
        objects: Array.isArray(parsed.objects) ? parsed.objects : [],
        patios: Array.isArray(parsed.patios) ? parsed.patios : [],
        poolBodies: Array.isArray(parsed.poolBodies) ? parsed.poolBodies : [],
      };
    }
  } catch {
    // fall through
  }
  return emptyDesignDocument(
    designLevel,
    unitSystem,
    DESIGN_LEVEL_CONFIG[designLevel].defaultLayers,
  );
}

export default async function ProjectCadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "platform_owner") redirect("/platform");
  if (!user.companyId) redirect("/login");

  const { id } = await params;
  const project = await prisma.project.findFirst({
    where: { id, companyId: user.companyId },
  });
  if (!project) notFound();

  const design = parseDesign(
    project.designJson,
    project.designLevel,
    user.unitSystem,
  );

  return (
    <div className="app-shell">
      <AppHeader user={user} />
      <main className="page" style={{ paddingTop: "0.85rem" }}>
        <CadWorkspace
          projectId={project.id}
          projectName={project.name}
          designLevel={project.designLevel}
          unitSystem={user.unitSystem}
          initialDesign={design}
        />
      </main>
    </div>
  );
}
