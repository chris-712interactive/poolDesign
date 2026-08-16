export type UserRole =
  | "platform_owner"
  | "company_admin"
  | "designer"
  | "estimator";

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  platform_owner: "Platform owner",
  company_admin: "Company admin",
  designer: "Designer",
  estimator: "Estimator",
};

export function isPlatformOwner(role: UserRole): boolean {
  return role === "platform_owner";
}

export function isCompanyStaff(role: UserRole): boolean {
  return role === "company_admin" || role === "designer" || role === "estimator";
}

/** CAD is for designers. Admins opt in with a designer seat (`alsoDesigner`). */
export function canUseCad(
  role: UserRole | string,
  alsoDesigner = false,
): boolean {
  if (role === "designer") return true;
  if (role === "company_admin" && alsoDesigner) return true;
  return false;
}

export function needsCompanySetup(user: {
  role: string;
  company?: { setupCompletedAt?: Date | string | null } | null;
}): boolean {
  if (user.role !== "company_admin") return false;
  return !user.company?.setupCompletedAt;
}
