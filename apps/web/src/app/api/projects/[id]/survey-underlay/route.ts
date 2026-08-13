import { NextResponse } from "next/server";
import { prisma } from "@pool-design/db";
import { getSessionUser } from "@/lib/auth";
import { companyHasAppAccess } from "@/lib/subscription";

type RouteContext = { params: Promise<{ id: string }> };

function localPostgres(): boolean {
  const url = process.env.DATABASE_URL ?? "";
  return url.includes("localhost") || url.includes("127.0.0.1");
}

const MAX_BYTES = 12_000_000;
const ALLOWED = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);

/**
 * Store a survey / plat raster for the 2D underlay.
 * Production uses Vercel Blob so the design JSON never holds image bytes.
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
    select: { id: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size < 8) {
    return NextResponse.json({ error: "Expected an image file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image too large (max 12 MB)" }, { status: 413 });
  }
  const type = (file.type || "").toLowerCase();
  if (!ALLOWED.has(type)) {
    return NextResponse.json(
      { error: "Use a PNG, JPG, or WebP export of the survey sheet." },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (token) {
    try {
      const { put } = await import("@vercel/blob");
      const blob = await put(`surveys/${project.id}/${Date.now()}.${ext}`, buffer, {
        access: "public",
        contentType: type === "image/jpg" ? "image/jpeg" : type,
        token,
      });
      return NextResponse.json({ url: blob.url });
    } catch (err) {
      console.error("survey blob upload failed", err);
      return NextResponse.json({ error: "Blob upload failed" }, { status: 500 });
    }
  }

  if (localPostgres()) {
    const b64 = buffer.toString("base64");
    return NextResponse.json({
      url: `data:${type === "image/jpg" ? "image/jpeg" : type};base64,${b64}`,
    });
  }

  return NextResponse.json(
    {
      error:
        "BLOB_READ_WRITE_TOKEN is required so survey images are stored in Vercel Blob, not Postgres.",
    },
    { status: 503 },
  );
}
