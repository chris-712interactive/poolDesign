import { NextResponse } from "next/server";
import { prisma } from "@pool-design/db";
import { getSessionUser } from "@/lib/auth";
import { createCompanyInvite } from "@/lib/invites";
import { companyHasAppAccess } from "@/lib/subscription";

/** List pending invites. */
export async function GET() {
  const user = await getSessionUser();
  if (!user?.companyId || user.role !== "company_admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const invites = await prisma.companyInvite.findMany({
    where: { companyId: user.companyId, acceptedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      token: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ invites });
}

/** Create invite; email the temp password when Resend is configured. */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user?.companyId || user.role !== "company_admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!companyHasAppAccess(user.company)) {
    return NextResponse.json({ error: "Subscription inactive" }, { status: 402 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    name?: string;
    role?: string;
  };

  const email = (body.email || "").toLowerCase().trim();
  const name = (body.name || "").trim();
  const role =
    body.role === "estimator" || body.role === "company_admin"
      ? body.role
      : "designer";

  if (!email || !name) {
    return NextResponse.json(
      { error: "Name and email are required" },
      { status: 400 },
    );
  }

  const result = await createCompanyInvite({
    companyId: user.companyId,
    invitedByUserId: user.id,
    email,
    name,
    role,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    email: result.email,
    name: result.name,
    role: result.role,
    inviteUrl: result.inviteUrl,
    emailSent: result.emailSent,
    temporaryPassword: result.temporaryPassword,
  });
}
