import { NextResponse } from "next/server";
import {
  buildMeasurementsHtml,
  buildPlanMeasurements,
  normalizeDesignDocument,
  type DesignLevel,
} from "@pool-design/shared";
import { getSessionUser } from "@/lib/auth";
import { designFromProject, loadCompanyProject } from "@/lib/project-docs";
import { companyHasAppAccess } from "@/lib/subscription";

/** Printable HTML measurements sheet (Print → Save as PDF). */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user?.companyId || !user.company) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!companyHasAppAccess(user.company)) {
    return NextResponse.json({ error: "Subscription inactive" }, { status: 402 });
  }

  const { id } = await context.params;
  const project = await loadCompanyProject(id, user.companyId);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const design = normalizeDesignDocument(
    designFromProject(project, user.unitSystem),
    {
      designLevel: project.designLevel as DesignLevel,
      unitSystem: user.unitSystem,
    },
  );
  const groups = buildPlanMeasurements(design, user.unitSystem);
  const html = buildMeasurementsHtml(
    {
      companyName: project.company.name,
      companyLogoUrl: project.company.logoUrl,
      companyRegion: project.company.region,
      projectName: project.name,
      clientName: project.clientName,
      phone: project.phone,
      address: project.address,
    },
    groups,
    user.unitSystem,
  );

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `inline; filename="${project.name.replace(/[^\w.-]+/g, "_")}-measurements.html"`,
    },
  });
}
