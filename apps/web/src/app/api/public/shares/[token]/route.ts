import { NextResponse } from "next/server";
import { prisma } from "@pool-design/db";
import { storedPreviewUrl } from "@pool-design/shared";

type RouteContext = { params: Promise<{ token: string }> };

/** Public (no auth) share payload for the client proposal page. */
export async function GET(_request: Request, context: RouteContext) {
  const { token } = await context.params;
  const share = await prisma.projectShare.findUnique({
    where: { token },
    include: {
      project: {
        include: {
          company: {
            select: {
              name: true,
              logoUrl: true,
              region: true,
              slug: true,
            },
          },
        },
      },
    },
  });

  if (!share || share.revokedAt) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (share.expiresAt && share.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "Expired" }, { status: 410 });
  }

  return NextResponse.json({
    token: share.token,
    includeEstimate: share.includeEstimate,
    previewImageUrl: storedPreviewUrl(share.previewImageUrl),
    previewVideoUrl: share.previewVideoUrl,
    createdAt: share.createdAt,
    expiresAt: share.expiresAt,
    project: {
      name: share.project.name,
      clientName: share.project.clientName,
      phone: share.project.phone,
      address: share.project.address,
      designLevel: share.project.designLevel,
      unitSystem: share.project.unitSystem,
    },
    company: share.project.company,
    design: JSON.parse(share.designSnapshotJson) as unknown,
    estimate: share.estimateSnapshotJson
      ? (JSON.parse(share.estimateSnapshotJson) as unknown)
      : null,
  });
}
