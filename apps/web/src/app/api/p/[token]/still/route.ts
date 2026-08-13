import { NextResponse } from "next/server";
import { prisma } from "@pool-design/db";
import { parseLiveSessionState, storedPreviewUrl } from "@pool-design/shared";

/**
 * Current 3D still for a public share. Only http(s) Blob URLs are served;
 * legacy data-URL stills are ignored so Neon is not asked to ship megabytes.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const share = await prisma.projectShare.findUnique({
    where: { token },
    select: {
      revokedAt: true,
      expiresAt: true,
      previewImageUrl: true,
      project: {
        select: {
          liveSession: {
            select: { active: true, stateJson: true },
          },
        },
      },
    },
  });
  if (!share || share.revokedAt) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (share.expiresAt && share.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const session = share.project.liveSession;
  const state = session
    ? parseLiveSessionState(JSON.parse(session.stateJson || "{}"))
    : null;
  const livePreview = storedPreviewUrl(state?.previewImageUrl);
  const sharePreview = storedPreviewUrl(share.previewImageUrl);
  const url = session?.active
    ? livePreview || sharePreview
    : sharePreview || livePreview;

  if (!url) {
    return NextResponse.json({ error: "No still" }, { status: 404 });
  }

  return NextResponse.redirect(url, 302);
}
