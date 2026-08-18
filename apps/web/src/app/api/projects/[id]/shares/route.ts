import { NextResponse } from "next/server";
import { prisma } from "@pool-design/db";
import {
  buildTakeoff,
  parseDesignDocument,
  storedPreviewUrl,
  type DesignLevel,
} from "@pool-design/shared";
import { getSessionUser } from "@/lib/auth";
import { companyHasAppAccess } from "@/lib/subscription";
import { appBaseUrl } from "@/lib/app-url";
import {
  catalogWithCompanyPrices,
  completeMilestone,
  loadCompanyEstimateRecipe,
  newShareToken,
} from "@/lib/shares";

type RouteContext = { params: Promise<{ id: string }> };

/** List active shares for a project. */
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
  });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const shares = await prisma.projectShare.findMany({
    where: { projectId: project.id, revokedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      token: true,
      includeEstimate: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  const appUrl = appBaseUrl();
  return NextResponse.json({
    shares: shares.map((s) => ({
      ...s,
      url: `${appUrl}/p/${s.token}`,
    })),
  });
}

/** Create a client share link (snapshots design + optional estimate). */
export async function POST(request: Request, context: RouteContext) {
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
    include: { company: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    includeEstimate?: boolean;
    previewImageUrl?: string | null;
    previewVideoUrl?: string | null;
    expiresInDays?: number | null;
  };

  const includeEstimate = body.includeEstimate === true;
  const design = parseDesignDocument(
    project.designJson,
    project.designLevel as DesignLevel,
    project.unitSystem,
  );

  let estimateSnapshotJson: string | null = null;
  if (includeEstimate) {
    const catalog = await catalogWithCompanyPrices(
      user.companyId,
      project.designLevel as DesignLevel,
    );
    const recipe = await loadCompanyEstimateRecipe(user.companyId);
    const takeoff = buildTakeoff(design, project.unitSystem, catalog, recipe);
    estimateSnapshotJson = JSON.stringify(takeoff);
  }

  const expiresAt =
    body.expiresInDays && body.expiresInDays > 0
      ? new Date(Date.now() + body.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

  const share = await prisma.projectShare.create({
    data: {
      projectId: project.id,
      token: newShareToken(),
      includeEstimate,
      designSnapshotJson: JSON.stringify(design),
      estimateSnapshotJson,
      previewImageUrl: storedPreviewUrl(body.previewImageUrl),
      previewVideoUrl: body.previewVideoUrl || null,
      createdByUserId: user.id,
      expiresAt,
    },
  });

  await completeMilestone(user.companyId, "first_client_share");

  const appUrl = appBaseUrl();
  return NextResponse.json({
    id: share.id,
    token: share.token,
    url: `${appUrl}/p/${share.token}`,
    includeEstimate: share.includeEstimate,
    previewImageUrl: storedPreviewUrl(share.previewImageUrl),
    expiresAt: share.expiresAt,
  });
}
