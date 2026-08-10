import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@pool-design/db";
import { getSessionUser } from "@/lib/auth";
import { appBaseUrl } from "@/lib/app-url";
import { completeMilestone, newInviteToken } from "@/lib/shares";
import { companyHasAppAccess } from "@/lib/subscription";

function tempPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 10; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

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

/** Create invite with temporary password (shown once). */
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

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "A user with that email already exists" },
      { status: 409 },
    );
  }

  const password = tempPassword();
  const temporaryPasswordHash = await bcrypt.hash(password, 10);
  const token = newInviteToken();
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  const invite = await prisma.companyInvite.create({
    data: {
      companyId: user.companyId,
      email,
      name,
      role,
      token,
      temporaryPasswordHash,
      invitedByUserId: user.id,
      expiresAt,
    },
  });

  await completeMilestone(user.companyId, "team_invited");

  return NextResponse.json({
    id: invite.id,
    email: invite.email,
    name: invite.name,
    role: invite.role,
    temporaryPassword: password,
    inviteUrl: `${appBaseUrl()}/invite/${invite.token}`,
    expiresAt: invite.expiresAt,
  });
}
