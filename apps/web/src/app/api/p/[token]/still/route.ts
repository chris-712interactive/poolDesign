import { NextResponse } from "next/server";
import { prisma } from "@pool-design/db";
import { parseLiveSessionState } from "@pool-design/shared";

/**
 * Serve the current 3D still for a public share.
 * Data-URL stills are decoded here so they never travel through the RSC payload
 * (which crashes production with a generic Server Components error).
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const share = await prisma.projectShare.findUnique({
    where: { token },
    include: {
      project: { include: { liveSession: true } },
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
  const livePreview = state?.previewImageUrl || null;
  const sharePreview = share.previewImageUrl || null;
  const url = session?.active
    ? livePreview || sharePreview
    : sharePreview || livePreview;

  if (!url) {
    return NextResponse.json({ error: "No still" }, { status: 404 });
  }

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return NextResponse.redirect(url, 302);
  }

  const match = /^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/.exec(url);
  if (!match) {
    return NextResponse.json({ error: "Invalid still" }, { status: 400 });
  }

  const contentType = match[1];
  const buffer = Buffer.from(match[2], "base64");
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
