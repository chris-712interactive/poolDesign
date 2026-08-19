import { NextResponse } from "next/server";
import { prisma } from "@pool-design/db";
import {
  applyDesignerRequestApproval,
  parseDesignStatus,
  storedVoiceUrl,
} from "@pool-design/shared";
import { getSessionUser } from "@/lib/auth";
import { companyHasAppAccess } from "@/lib/subscription";

type RouteContext = { params: Promise<{ id: string }> };

/** Designer: workflow status + timestamped client reviews. */
export async function GET(_request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user?.companyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!companyHasAppAccess(user.company)) {
    return NextResponse.json({ error: "Subscription inactive" }, { status: 402 });
  }

  const { id } = await context.params;
  const project = await prisma.project.findFirst({
    where: { id, companyId: user.companyId },
    select: {
      id: true,
      designStatus: true,
      requestClientApproval: true,
      reviews: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          kind: true,
          noteText: true,
          voiceUrl: true,
          createdAt: true,
          shareId: true,
        },
      },
    },
  });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    designStatus: parseDesignStatus(project.designStatus),
    requestClientApproval: project.requestClientApproval,
    reviews: project.reviews.map((r) => ({
      ...r,
      voiceUrl: storedVoiceUrl(r.voiceUrl),
      createdAt: r.createdAt.toISOString(),
    })),
  });
}

/** Designer: show or hide the client Approve button for this revision. */
export async function PATCH(request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user?.companyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!companyHasAppAccess(user.company)) {
    return NextResponse.json({ error: "Subscription inactive" }, { status: 402 });
  }

  const { id } = await context.params;
  const project = await prisma.project.findFirst({
    where: { id, companyId: user.companyId },
    select: { id: true, designStatus: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    requestClientApproval?: boolean;
  };
  if (typeof body.requestClientApproval !== "boolean") {
    return NextResponse.json(
      { error: "requestClientApproval is required." },
      { status: 400 },
    );
  }

  const patch = applyDesignerRequestApproval(
    body.requestClientApproval,
    parseDesignStatus(project.designStatus),
  );
  const updated = await prisma.project.update({
    where: { id: project.id },
    data: {
      requestClientApproval: patch.requestClientApproval,
      designStatus: patch.designStatus,
    },
    select: { designStatus: true, requestClientApproval: true },
  });

  return NextResponse.json({
    ok: true,
    designStatus: parseDesignStatus(updated.designStatus),
    requestClientApproval: updated.requestClientApproval,
  });
}
