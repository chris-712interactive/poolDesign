import type { UserRole } from "./roles";

/**
 * One designer seat is included with Sales/Builder. Extra seats are billed.
 * During an active local trial, every designer is licensed; extras attach to
 * the company Checkout when they subscribe — not as a standalone charge.
 */
export const INCLUDED_DESIGNER_SEATS = 1;

/** Display price for an extra designer license. Stripe Price ID is the charge. */
export const DESIGNER_SEAT_MONTHLY_CENTS = 4000;

export const COMPANY_STAFF_ROLES = [
  "company_admin",
  "designer",
  "estimator",
] as const;

export type CompanyStaffRole = (typeof COMPANY_STAFF_ROLES)[number];

export const STAFF_ROLE_LABELS: Record<CompanyStaffRole, string> = {
  company_admin: "Admin",
  designer: "Designer",
  estimator: "Estimator",
};

export function isCompanyStaffRole(value: string): value is CompanyStaffRole {
  return (COMPANY_STAFF_ROLES as readonly string[]).includes(value);
}

export function designerSeatCapacity(paidExtraSeats: number): number {
  return INCLUDED_DESIGNER_SEATS + Math.max(0, Math.floor(paidExtraSeats));
}

export function extraDesignerSeatsNeeded(designerCount: number): number {
  return Math.max(0, designerCount - INCLUDED_DESIGNER_SEATS);
}

/** Paid plans only — trial companies do not charge extra seats until subscribe. */
export function designerAssignmentNeedsPaidSeat(opts: {
  nextDesignerCount: number;
  paidExtraSeats: number;
  trialActive: boolean;
}): boolean {
  if (opts.trialActive) return false;
  return (
    extraDesignerSeatsNeeded(opts.nextDesignerCount) >
    Math.max(0, Math.floor(opts.paidExtraSeats))
  );
}

/** Oldest grants keep the included + paid seats when Stripe quantity drops. */
export function userHasLicensedDesignerSeat(opts: {
  userId: string;
  designerUserIdsOldestFirst: readonly string[];
  paidExtraSeats: number;
  trialActive?: boolean;
}): boolean {
  const index = opts.designerUserIdsOldestFirst.indexOf(opts.userId);
  if (index < 0) return false;
  if (opts.trialActive) return true;
  return index < designerSeatCapacity(opts.paidExtraSeats);
}

export function primaryRoleFromGrants(
  roles: readonly string[],
): UserRole | null {
  if (roles.includes("company_admin")) return "company_admin";
  if (roles.includes("designer")) return "designer";
  if (roles.includes("estimator")) return "estimator";
  return null;
}

export function alsoDesignerFromGrants(roles: readonly string[]): boolean {
  return roles.includes("company_admin") && roles.includes("designer");
}

export function designerSeatWarning(monthlyCents = DESIGNER_SEAT_MONTHLY_CENTS): string {
  const dollars = (monthlyCents / 100).toFixed(0);
  return `This adds a designer license at $${dollars}/month on your Sales or Builder subscription. If the license lapses, this person loses CAD access.`;
}
