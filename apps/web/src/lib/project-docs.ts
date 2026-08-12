import { prisma } from "@pool-design/db";
import {
  buildTakeoff,
  normalizeDesignDocument,
  parseDesignDocument,
  type DesignDocument,
  type DesignLevel,
  type TakeoffResult,
} from "@pool-design/shared";
import { catalogWithCompanyPrices } from "@/lib/shares";
import type { SessionUser } from "@/lib/auth";

export async function loadCompanyProject(
  projectId: string,
  companyId: string,
) {
  return prisma.project.findFirst({
    where: { id: projectId, companyId },
    include: {
      company: true,
    },
  });
}

export function designFromProject(
  project: {
    designJson: string;
    designLevel: string;
    unitSystem: string;
  },
  unitSystem?: "imperial" | "metric",
): DesignDocument {
  return parseDesignDocument(
    project.designJson,
    project.designLevel as DesignLevel,
    (unitSystem ?? project.unitSystem) as "imperial" | "metric",
  );
}

export async function takeoffForProject(
  project: {
    id: string;
    companyId: string;
    designJson: string;
    designLevel: string;
    unitSystem: string;
  },
  user: SessionUser,
): Promise<{ design: DesignDocument; takeoff: TakeoffResult }> {
  const design = normalizeDesignDocument(
    designFromProject(project, user.unitSystem),
    {
      designLevel: project.designLevel as DesignLevel,
      unitSystem: user.unitSystem,
    },
  );
  const catalog = await catalogWithCompanyPrices(
    project.companyId,
    project.designLevel as DesignLevel,
  );
  const takeoff = buildTakeoff(design, user.unitSystem, catalog);
  return { design, takeoff };
}
