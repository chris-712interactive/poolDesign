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
