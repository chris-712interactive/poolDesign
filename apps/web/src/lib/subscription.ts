import type { Company, SubscriptionStatus } from "@pool-design/db";
import {
  companyHasEntitlement,
  entitlementsForCompany,
  planDisplayName,
  planTierForKey,
  type EntitlementKey,
  type PlanEntitlements,
} from "@pool-design/shared";

const BLOCKED: SubscriptionStatus[] = ["canceled", "suspended"];

/** Soft gate: trialing/active/past_due allowed; canceled/suspended blocked. */
export function companyHasAppAccess(company: Company | null | undefined): boolean {
  if (!company) return true; // platform owner has no company
  return !BLOCKED.includes(company.subscriptionStatus);
}

export function subscriptionAccessMessage(status: SubscriptionStatus): string {
  if (status === "canceled") {
    return "Your subscription is canceled. Renew billing to continue designing.";
  }
  if (status === "suspended") {
    return "This company account is suspended. Contact support or renew billing.";
  }
  if (status === "past_due") {
    return "Payment is past due. Update billing to avoid interruption.";
  }
  return "";
}

export function companyEntitlements(
  company: Company | null | undefined,
): PlanEntitlements {
  return entitlementsForCompany(company);
}

export function requireEntitlement(
  company: Company | null | undefined,
  key: EntitlementKey,
): { ok: true } | { ok: false; error: string; status: number } {
  if (!company) {
    return { ok: false, error: "Company required", status: 401 };
  }
  if (!companyHasAppAccess(company)) {
    return { ok: false, error: "Subscription inactive", status: 402 };
  }
  if (!companyHasEntitlement(company, key)) {
    const tier = planDisplayName(company.planKey);
    return {
      ok: false,
      error: `Upgrade to Builder to use this feature (current plan: ${tier}).`,
      status: 403,
    };
  }
  return { ok: true };
}

export { companyHasEntitlement, planDisplayName, planTierForKey };
