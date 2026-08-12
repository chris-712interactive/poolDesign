import { NextResponse } from "next/server";
import {
  buildPermitPacket,
  buildPermitPacketHtml,
} from "@pool-design/shared";
import { getSessionUser } from "@/lib/auth";
import { designFromProject, loadCompanyProject } from "@/lib/project-docs";
import { requireEntitlement } from "@/lib/subscription";

/** Draft (non-stamped) permit packet HTML. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user?.companyId || !user.company) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const gate = requireEntitlement(user.company, "permitPacket");
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const { id } = await context.params;
  const project = await loadCompanyProject(id, user.companyId);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const design = designFromProject(project, user.unitSystem);
  const packet = buildPermitPacket(design, user.unitSystem);
  const html = buildPermitPacketHtml(
    {
      companyName: project.company.name,
      projectName: project.name,
      clientName: project.clientName,
      address: project.address,
    },
    packet,
  );

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `inline; filename="${project.name.replace(/[^\w.-]+/g, "_")}-permit-draft.html"`,
    },
  });
}
