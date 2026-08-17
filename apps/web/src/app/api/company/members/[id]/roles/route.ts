import { NextResponse } from "next/server";
import { prisma } from "@pool-design/db";
import {
  DESIGNER_SEAT_MONTHLY_CENTS,
  designerAssignmentNeedsPaidSeat,
  designerSeatWarning,
  isCompanyStaffRole,
  isLocalTrialActive,
} from "@pool-design/shared";
import { getSessionUser } from "@/lib/auth";
import { companyHasAppAccess } from "@/lib/subscription";
import {
  countAdmins,
  designerUserIdsOldestFirst,
  grantRoles,
} from "@/lib/roleGrants";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const admin = await getSessionUser();
  if (!admin?.companyId || admin.role !== "company_admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!companyHasAppAccess(admin.company)) {
    return NextResponse.json({ error: "Subscription inactive" }, { status: 402 });
  }

  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { roles?: string[] };
  const roles = (body.roles ?? []).filter(isCompanyStaffRole);
  if (roles.length === 0) {
    return NextResponse.json(
      { error: "Each person needs at least one role." },
      { status: 400 },
    );
  }

  const member = await prisma.user.findFirst({
    where: { id, companyId: admin.companyId },
    include: { roleGrants: { select: { role: true } } },
  });
  if (!member) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const current = member.roleGrants
    .map((g) => g.role)
    .filter(isCompanyStaffRole);
  const addingDesigner =
    roles.includes("designer") && !current.includes("designer");
  const removingAdmin =
    current.includes("company_admin") && !roles.includes("company_admin");

  if (removingAdmin) {
    const admins = await countAdmins(admin.companyId);
    if (admins <= 1) {
      return NextResponse.json(
        { error: "Keep at least one company admin." },
        { status: 400 },
      );
    }
  }

  if (addingDesigner) {
    const designerIds = await designerUserIdsOldestFirst(admin.companyId);
    if (
      designerAssignmentNeedsPaidSeat({
        nextDesignerCount: designerIds.length + 1,
        paidExtraSeats: admin.company?.designerSeatsPaid ?? 0,
        trialActive: isLocalTrialActive(admin.company),
      })
    ) {
      return NextResponse.json(
        {
          requiresCheckout: true,
          userId: member.id,
          roles,
          monthlyCents: DESIGNER_SEAT_MONTHLY_CENTS,
          warning: designerSeatWarning(),
        },
        { status: 409 },
      );
    }
  }

  const saved = await grantRoles({
    userId: member.id,
    companyId: admin.companyId,
    roles,
  });

  return NextResponse.json({ ok: true, roles: saved });
}
