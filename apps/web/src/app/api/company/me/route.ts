import { NextResponse } from "next/server";
import {
  DESIGNER_SEAT_MONTHLY_CENTS,
  designerAssignmentNeedsPaidSeat,
  designerSeatWarning,
  isCompanyStaffRole,
  isLocalTrialActive,
} from "@pool-design/shared";
import { getSessionUser } from "@/lib/auth";
import { designerUserIdsOldestFirst, grantRoles } from "@/lib/roleGrants";

/** Company admin: take or drop a designer seat on your own account. */
export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user?.companyId || user.role !== "company_admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    alsoDesigner?: boolean;
  };
  if (typeof body.alsoDesigner !== "boolean") {
    return NextResponse.json({ error: "alsoDesigner is required" }, { status: 400 });
  }

  const roles = new Set(
    user.roleGrants.map((g) => g.role).filter(isCompanyStaffRole),
  );
  roles.add("company_admin");
  if (body.alsoDesigner) roles.add("designer");
  else roles.delete("designer");

  const addingDesigner =
    body.alsoDesigner && !user.roleGrants.some((g) => g.role === "designer");
  if (addingDesigner) {
    const designerIds = await designerUserIdsOldestFirst(user.companyId);
    if (
      designerAssignmentNeedsPaidSeat({
        nextDesignerCount: designerIds.length + 1,
        paidExtraSeats: user.company?.designerSeatsPaid ?? 0,
        trialActive: isLocalTrialActive(user.company),
      })
    ) {
      return NextResponse.json(
        {
          requiresCheckout: true,
          warning: designerSeatWarning(),
          monthlyCents: DESIGNER_SEAT_MONTHLY_CENTS,
          error: "Extra designer licenses are added from Team after you subscribe.",
        },
        { status: 409 },
      );
    }
  }

  const saved = await grantRoles({
    userId: user.id,
    companyId: user.companyId,
    roles: [...roles],
  });

  return NextResponse.json({
    alsoDesigner: saved.includes("designer"),
    roles: saved,
  });
}
