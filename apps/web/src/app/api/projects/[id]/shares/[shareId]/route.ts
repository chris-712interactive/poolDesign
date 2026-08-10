import { NextResponse } from "next/server";
import { prisma } from "@pool-design/db";
import { getSessionUser } from "@/lib/auth";
import { companyHasAppAccess } from "@/lib/subscription";

type RouteContext = { params: Promise<{ id: string; shareId: string }> };

/** Revoke a share link. */
export async function DELETE(_request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user?.companyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!companyHasAppAccess(user.company)) {
    return NextResponse.json({ error: "Subscription inactive" }, { status: 402 });
  }

  const { id, shareId } = await context.params;
  const project = await prisma.project.findFirst({
    where: { id, companyId: user.companyId },
  });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const share = await prisma.projectShare.findFirst({
    where: { id: shareId, projectId: project.id },
  });
  if (!share) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.projectShare.update({
    where: { id: share.id },
    data: { revokedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}

/** Update preview media on an existing share. */
export async function PATCH(request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user?.companyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, shareId } = await context.params;
  const project = await prisma.project.findFirst({
    where: { id, companyId: user.companyId },
  });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const share = await prisma.projectShare.findFirst({
    where: { id: shareId, projectId: project.id, revokedAt: null },
  });
  if (!share) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    previewImageUrl?: string | null;
    previewVideoUrl?: string | null;
  };

  const updated = await prisma.projectShare.update({
    where: { id: share.id },
    data: {
      ...(body.previewImageUrl !== undefined
        ? { previewImageUrl: body.previewImageUrl }
        : {}),
      ...(body.previewVideoUrl !== undefined
        ? { previewVideoUrl: body.previewVideoUrl }
        : {}),
    },
  });

  return NextResponse.json({
    id: updated.id,
    previewImageUrl: updated.previewImageUrl,
    previewVideoUrl: updated.previewVideoUrl,
  });
}
