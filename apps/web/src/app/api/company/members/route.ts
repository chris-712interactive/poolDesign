import { NextResponse } from "next/server";
import { prisma } from "@pool-design/db";
import {
  DESIGNER_SEAT_MONTHLY_CENTS,
  INCLUDED_DESIGNER_SEATS,
  designerSeatCapacity,
  extraDesignerSeatsNeeded,
  isCompanyStaffRole,
  userHasLicensedDesignerSeat,
} from "@pool-design/shared";
import { getSessionUser } from "@/lib/auth";
import { ensureRoleGrants } from "@/lib/roleGrants";

export async function GET() {
  const user = await getSessionUser();
  if (!user?.companyId || user.role !== "company_admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const members = await prisma.user.findMany({
    where: { companyId: user.companyId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      alsoDesigner: true,
      roleGrants: { select: { role: true, createdAt: true } },
    },
  });

  for (const member of members) {
    if (member.roleGrants.length === 0) {
      const roles = await ensureRoleGrants({
        userId: member.id,
        companyId: user.companyId,
        role: member.role,
        alsoDesigner: member.alsoDesigner,
      });
      member.roleGrants = roles.map((role) => ({
        role,
        createdAt: new Date(),
      }));
    }
  }

  const designerIds = members
    .filter((m) => m.roleGrants.some((g) => g.role === "designer"))
    .sort((a, b) => {
      const aAt =
        a.roleGrants.find((g) => g.role === "designer")?.createdAt.getTime() ??
        0;
      const bAt =
        b.roleGrants.find((g) => g.role === "designer")?.createdAt.getTime() ??
        0;
      return aAt - bAt;
    })
    .map((m) => m.id);

  const paid = user.company?.designerSeatsPaid ?? 0;
  const capacity = designerSeatCapacity(paid);

  return NextResponse.json({
    includedDesignerSeats: INCLUDED_DESIGNER_SEATS,
    paidDesignerSeats: paid,
    designerCapacity: capacity,
    extraDesignerSeats: extraDesignerSeatsNeeded(designerIds.length),
    seatMonthlyCents: DESIGNER_SEAT_MONTHLY_CENTS,
    members: members.map((member) => {
      const roles = member.roleGrants
        .map((g) => g.role)
        .filter(isCompanyStaffRole);
      return {
        id: member.id,
        name: member.name,
        email: member.email,
        isSelf: member.id === user.id,
        roles,
        designerLicensed: userHasLicensedDesignerSeat({
          userId: member.id,
          designerUserIdsOldestFirst: designerIds,
          paidExtraSeats: paid,
        }),
      };
    }),
  });
}
