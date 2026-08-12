import { NextResponse } from "next/server";
import {
  buildQuoteHtml,
  planDisplayName,
} from "@pool-design/shared";
import { getSessionUser } from "@/lib/auth";
import { takeoffForProject, loadCompanyProject } from "@/lib/project-docs";
import { requireEntitlement } from "@/lib/subscription";

/** Printable HTML quote (Print → Save as PDF). */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user?.companyId || !user.company) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const gate = requireEntitlement(user.company, "pdfQuote");
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const { id } = await context.params;
  const project = await loadCompanyProject(id, user.companyId);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { takeoff } = await takeoffForProject(project, user);
  const html = buildQuoteHtml(
    {
      companyName: project.company.name,
      companyLogoUrl: project.company.logoUrl,
      companyRegion: project.company.region,
      projectName: project.name,
      clientName: project.clientName,
      address: project.address,
      planLabel: planDisplayName(project.company.planKey),
    },
    takeoff,
  );

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `inline; filename="${project.name.replace(/[^\w.-]+/g, "_")}-quote.html"`,
    },
  });
}
