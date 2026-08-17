import { NextResponse } from "next/server";
import { prisma } from "@pool-design/db";
import {
  formatAddressLine,
  normalizeAddress,
  normalizeDesignDocument,
  type DesignDocument,
  type DesignLevel,
} from "@pool-design/shared";
import { getSessionUser } from "@/lib/auth";
import { companyHasAppAccess } from "@/lib/subscription";

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
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

  const body = (await request.json()) as {
    design?: unknown;
    expectedRevision?: number;
  };
  if (!body.design || typeof body.design !== "object") {
    return NextResponse.json({ error: "Missing design" }, { status: 400 });
  }

  if (
    typeof body.expectedRevision === "number" &&
    body.expectedRevision !== project.designRevision
  ) {
    return NextResponse.json(
      {
        error: "Design was updated elsewhere. Reload and try again.",
        designRevision: project.designRevision,
      },
      { status: 409 },
    );
  }

  const design = normalizeDesignDocument(body.design as DesignDocument, {
    designLevel: project.designLevel as DesignLevel,
    unitSystem: user.unitSystem,
  });

  const updated = await prisma.project.update({
    where: { id: project.id },
    data: {
      designJson: JSON.stringify(design),
      unitSystem: user.unitSystem,
      designRevision: { increment: 1 },
    },
  });

  const designSaved = await prisma.onboardingMilestone.findUnique({
    where: { key: "first_design_saved" },
  });
  if (designSaved) {
    await prisma.companyMilestoneStatus.updateMany({
      where: {
        companyId: user.companyId,
        milestoneId: designSaved.id,
        state: { in: ["pending", "in_progress"] },
      },
      data: {
        state: "completed",
        source: "system",
        completedAt: new Date(),
      },
    });
  }

  return NextResponse.json({
    ok: true,
    designRevision: updated.designRevision,
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
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

  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    clientName?: string | null;
    phone?: string | null;
    street?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
    country?: string | null;
  };

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Project name is required." }, { status: 400 });
  }

  const site = normalizeAddress({
    street: body.street,
    city: body.city,
    state: body.state,
    postalCode: body.postalCode,
    country: body.country,
  });
  const clientName =
    typeof body.clientName === "string" ? body.clientName.trim() || null : null;
  const phone = typeof body.phone === "string" ? body.phone.trim() || null : null;

  const updated = await prisma.project.update({
    where: { id: project.id },
    data: {
      name,
      clientName,
      phone,
      street: site.street,
      city: site.city,
      state: site.state,
      postalCode: site.postalCode,
      country: site.country,
      address: formatAddressLine(site),
    },
  });

  return NextResponse.json({
    ok: true,
    id: updated.id,
    name: updated.name,
    clientName: updated.clientName,
    phone: updated.phone,
    address: updated.address,
    street: updated.street,
    city: updated.city,
    state: updated.state,
    postalCode: updated.postalCode,
    country: updated.country,
  });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
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
    select: { id: true, name: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.project.delete({ where: { id: project.id } });
  return NextResponse.json({ ok: true, name: project.name });
}
