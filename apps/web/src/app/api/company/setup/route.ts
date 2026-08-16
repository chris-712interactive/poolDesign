import { NextResponse } from "next/server";
import { prisma } from "@pool-design/db";
import { getSessionUser } from "@/lib/auth";
import { createCompanyInvite } from "@/lib/invites";
import { companyHasAppAccess } from "@/lib/subscription";

type Body = {
  alsoDesigner?: boolean;
  invite?: { name?: string; email?: string } | null;
};

/** Finish the post-signup wizard: designer seat and/or first invite. */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user?.companyId || user.role !== "company_admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!companyHasAppAccess(user.company)) {
    return NextResponse.json({ error: "Subscription inactive" }, { status: 402 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const alsoDesigner = body.alsoDesigner === true;
  const inviteName = body.invite?.name?.trim() ?? "";
  const inviteEmail = body.invite?.email?.trim() ?? "";
  const wantsInvite = Boolean(inviteName || inviteEmail);

  if (!alsoDesigner && !wantsInvite) {
    return NextResponse.json(
      { error: "Choose to design yourself, invite a designer, or both." },
      { status: 400 },
    );
  }

  let invite: Awaited<ReturnType<typeof createCompanyInvite>> | null = null;
  if (wantsInvite) {
    invite = await createCompanyInvite({
      companyId: user.companyId,
      invitedByUserId: user.id,
      name: inviteName,
      email: inviteEmail,
      role: "designer",
    });
    if (!invite.ok) {
      return NextResponse.json({ error: invite.error }, { status: invite.status });
    }
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { alsoDesigner },
    }),
    prisma.company.update({
      where: { id: user.companyId },
      data: { setupCompletedAt: new Date() },
    }),
  ]);

  return NextResponse.json({
    alsoDesigner,
    invite: invite && invite.ok
      ? {
          email: invite.email,
          inviteUrl: invite.inviteUrl,
          temporaryPassword: invite.temporaryPassword,
        }
      : null,
  });
}
