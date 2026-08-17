import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { grantRoles } from "@/lib/roleGrants";
import { isCompanyStaffRole } from "@pool-design/shared";

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
