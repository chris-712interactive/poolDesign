import {
  canUseCad,
  needsCompanySetup,
  userHasLicensedDesignerSeat,
} from "@pool-design/shared";
import type { SessionUser } from "@/lib/auth";
import { designerUserIdsOldestFirst } from "@/lib/roleGrants";

export function appHomePath(user: SessionUser): string {
  if (user.role === "platform_owner") return "/platform";
  if (needsCompanySetup(user)) return "/app/setup";
  return "/app";
}

export function userCanUseCad(user: SessionUser): boolean {
  return canUseCad(
    user.role,
    user.alsoDesigner,
    user.roleGrants.map((g) => g.role),
  );
}

/** Designer grant plus a seat that Stripe (or the included seat) still covers. */
export async function userHasLicensedCadAccess(
  user: SessionUser,
): Promise<boolean> {
  if (!userCanUseCad(user) || !user.companyId || !user.company) return false;
  const ids = await designerUserIdsOldestFirst(user.companyId);
  return userHasLicensedDesignerSeat({
    userId: user.id,
    designerUserIdsOldestFirst: ids,
    paidExtraSeats: user.company.designerSeatsPaid,
  });
}
