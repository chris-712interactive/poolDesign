import { NextResponse } from "next/server";
import { prisma } from "@pool-design/db";
import { getSessionUser } from "@/lib/auth";
import { companyHasAppAccess } from "@/lib/subscription";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Upload a PNG (or WebP) preview for proposal shares.
 * Uses Vercel Blob when BLOB_READ_WRITE_TOKEN is set; otherwise stores a data URL
 * (fine for local/pilot; prefer Blob in production).
 */
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
  });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as {
    dataUrl?: string;
    contentType?: string;
  } | null;

  if (!body?.dataUrl?.startsWith("data:image/")) {
    return NextResponse.json(
      { error: "Expected dataUrl (data:image/...;base64,...)" },
      { status: 400 },
    );
  }

  // Cap ~2.5MB base64 payload
  if (body.dataUrl.length > 3_500_000) {
    return NextResponse.json({ error: "Image too large" }, { status: 413 });
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (token) {
    try {
      const { put } = await import("@vercel/blob");
      const match = /^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/.exec(
        body.dataUrl,
      );
      if (!match) {
        return NextResponse.json({ error: "Invalid data URL" }, { status: 400 });
      }
      const contentType = match[1];
      const buffer = Buffer.from(match[2], "base64");
      const blob = await put(
        `proposals/${project.id}/${Date.now()}.png`,
        buffer,
        {
          access: "public",
          contentType,
          token,
        },
      );
      return NextResponse.json({ url: blob.url });
    } catch (err) {
      console.error("blob upload failed", err);
      return NextResponse.json(
        { error: "Blob upload failed" },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ url: body.dataUrl });
}
