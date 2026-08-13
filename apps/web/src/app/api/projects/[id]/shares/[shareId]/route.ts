import { NextResponse } from "next/server";
import { prisma } from "@pool-design/db";
import {
  buildTakeoff,
  parseDesignDocument,
  parseLiveSessionState,
  storedPreviewUrl,
  type DesignLevel,
} from "@pool-design/shared";
import { getSessionUser } from "@/lib/auth";
import { companyHasAppAccess } from "@/lib/subscription";
import { catalogWithCompanyPrices } from "@/lib/shares";

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

/**
 * Refresh an existing share in place (same client URL):
 * - preview still / video
 * - optional design + estimate snapshots from current project
 */
export async function PATCH(request: Request, context: RouteContext) {
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
    where: { id: shareId, projectId: project.id, revokedAt: null },
  });
  if (!share) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    previewImageUrl?: string | null;
    previewVideoUrl?: string | null;
    /** Re-snapshot designJson (and estimate if share includes it). */
    refreshSnapshot?: boolean;
  };

  const data: {
    previewImageUrl?: string | null;
    previewVideoUrl?: string | null;
    designSnapshotJson?: string;
    estimateSnapshotJson?: string | null;
  } = {};

  if (body.previewImageUrl !== undefined) {
    const still = storedPreviewUrl(body.previewImageUrl);
    if (still) data.previewImageUrl = still;
  }
  if (body.previewVideoUrl !== undefined) {
    data.previewVideoUrl = body.previewVideoUrl;
  }

  if (body.refreshSnapshot) {
    const design = parseDesignDocument(
      project.designJson,
      project.designLevel as DesignLevel,
      project.unitSystem,
    );
    data.designSnapshotJson = JSON.stringify(design);
    if (share.includeEstimate) {
      const catalog = await catalogWithCompanyPrices(
        user.companyId,
        project.designLevel as DesignLevel,
      );
      const takeoff = buildTakeoff(design, project.unitSystem, catalog);
      data.estimateSnapshotJson = JSON.stringify(takeoff);
    }
  }

  const updated = await prisma.projectShare.update({
    where: { id: share.id },
    data,
  });

  // Client live poll prefers live-session still while a session exists.
  // Mirror the new still so "Update still" shows up without a reload.
  if (typeof data.previewImageUrl === "string" && data.previewImageUrl) {
    const live = await prisma.projectLiveSession.findUnique({
      where: { projectId: project.id },
      select: { id: true, stateJson: true },
    });
    if (live) {
      const state = parseLiveSessionState(JSON.parse(live.stateJson || "{}"));
      state.previewImageUrl = data.previewImageUrl;
      await prisma.projectLiveSession.update({
        where: { id: live.id },
        data: { stateJson: JSON.stringify(state) },
      });
    }
  }

  return NextResponse.json({
    id: updated.id,
    previewImageUrl: updated.previewImageUrl,
    previewVideoUrl: updated.previewVideoUrl,
    refreshedSnapshot: Boolean(body.refreshSnapshot),
  });
}
