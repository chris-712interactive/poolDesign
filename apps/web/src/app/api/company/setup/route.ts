import { NextResponse } from "next/server";
import { prisma } from "@pool-design/db";
import {
  formatAddressLine,
  normalizeAddress,
} from "@pool-design/shared";
import { getSessionUser } from "@/lib/auth";
import { createCompanyInvite } from "@/lib/invites";
import { grantRoles } from "@/lib/roleGrants";
import { completeMilestone } from "@/lib/shares";
import { companyHasAppAccess } from "@/lib/subscription";

type Body = {
  alsoDesigner?: boolean;
  invite?: { name?: string; email?: string } | null;
  profile?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    region?: string;
    defaultUnitSystem?: "imperial" | "metric";
  };
};

/** Finish the post-signup wizard: company profile, designer seat, and/or first invite. */
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
  const hq = normalizeAddress(body.profile ?? {});
  const region = body.profile?.region?.trim() || null;
  const defaultUnitSystem =
    body.profile?.defaultUnitSystem === "metric" ? "metric" : "imperial";

  if (!hq.city || !hq.state) {
    return NextResponse.json(
      { error: "Enter the company city and state." },
      { status: 400 },
    );
  }
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

  const roles = alsoDesigner
    ? (["company_admin", "designer"] as const)
    : (["company_admin"] as const);
  await grantRoles({
    userId: user.id,
    companyId: user.companyId,
    roles,
  });
  await prisma.company.update({
    where: { id: user.companyId },
    data: {
      setupCompletedAt: new Date(),
      street: hq.street,
      city: hq.city,
      state: hq.state,
      postalCode: hq.postalCode,
      country: hq.country,
      region,
      defaultUnitSystem,
    },
  });
  await completeMilestone(user.companyId, "company_profile");

  return NextResponse.json({
    alsoDesigner,
    address: formatAddressLine(hq),
    invite: invite && invite.ok
      ? {
          email: invite.email,
          inviteUrl: invite.inviteUrl,
          emailSent: invite.emailSent,
          emailError: invite.emailError,
          temporaryPassword: invite.temporaryPassword,
        }
      : null,
  });
}
