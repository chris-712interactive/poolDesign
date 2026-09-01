import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@pool-design/db";
import { setSessionCookie } from "@/lib/auth";
import { grantRoles } from "@/lib/roleGrants";
import { isCompanyStaffRole } from "@pool-design/shared";
import { MIN_PASSWORD } from "@/lib/password";
import { ipFromHeaders } from "@/lib/request-ip";
import {
  AUTH_LIMITS,
  assertNotThrottled,
  ThrottleError,
  throttleJson,
} from "@/lib/throttle";

type RouteContext = { params: Promise<{ token: string }> };

/** Accept an invite: verify temp password, create user, start session. */
export async function POST(request: Request, context: RouteContext) {
  const ip = ipFromHeaders(request.headers);
  try {
    await assertNotThrottled({
      key: `invite-accept:ip:${ip}`,
      ...AUTH_LIMITS.inviteAcceptIp,
    });
  } catch (err) {
    if (err instanceof ThrottleError) return throttleJson();
    throw err;
  }
  const { token } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    temporaryPassword?: string;
    newPassword?: string;
  };

  const invite = await prisma.companyInvite.findUnique({
    where: { token },
    include: { company: true },
  });
  if (!invite || invite.acceptedAt) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }
  if (invite.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "Invite expired" }, { status: 410 });
  }

  const temp = body.temporaryPassword || "";
  const ok = await bcrypt.compare(temp, invite.temporaryPasswordHash);
  if (!ok) {
    return NextResponse.json({ error: "Invalid temporary password" }, { status: 401 });
  }

  const existing = await prisma.user.findUnique({
    where: { email: invite.email },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Account already exists — sign in instead" },
      { status: 409 },
    );
  }

  const password =
    body.newPassword && body.newPassword.length >= MIN_PASSWORD
      ? body.newPassword
      : temp;
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email: invite.email,
      name: invite.name,
      passwordHash,
      role: invite.role,
      alsoDesigner: false,
      companyId: invite.companyId,
      unitSystem: invite.company.defaultUnitSystem,
    },
  });
  const granted = isCompanyStaffRole(invite.role)
    ? [invite.role]
    : (["designer"] as const);
  await grantRoles({
    userId: user.id,
    companyId: invite.companyId,
    roles: granted,
  });

  await prisma.companyInvite.update({
    where: { id: invite.id },
    data: { acceptedAt: new Date() },
  });

  await setSessionCookie(user.id, user.sessionEpoch);

  return NextResponse.json({ ok: true, redirectTo: "/app" });
}
