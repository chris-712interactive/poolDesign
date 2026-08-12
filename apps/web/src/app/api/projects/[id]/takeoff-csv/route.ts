import { NextResponse } from "next/server";
import { takeoffToCsv } from "@pool-design/shared";
import { getSessionUser } from "@/lib/auth";
import { loadCompanyProject, takeoffForProject } from "@/lib/project-docs";
import { requireEntitlement } from "@/lib/subscription";

/** CSV takeoff export for estimators. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user?.companyId || !user.company) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const gate = requireEntitlement(user.company, "csvTakeoff");
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const { id } = await context.params;
  const project = await loadCompanyProject(id, user.companyId);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { takeoff } = await takeoffForProject(project, user);
  const csv = takeoffToCsv(takeoff);
  const filename = `${project.name.replace(/[^\w.-]+/g, "_")}-takeoff.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
