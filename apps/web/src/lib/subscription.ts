import type { Company } from "@pool-design/db";
import { prisma } from "@pool-design/db";
import {
  companyHasAppAccess as accessFromBilling,
  companyHasEntitlement,
  entitlementsForCompany,
  isLocalTrialExpired,
  planDisplayName,
  planTierForKey,
  subscriptionAccessMessage as billingAccessMessage,
  type EntitlementKey,
  type PlanEntitlements,
} from "@pool-design/shared";

export function companyHasAppAccess(
  company: Company | null | undefined,
): boolean {
  if (!company) return true;
  return accessFromBilling(company);
}

export function subscriptionAccessMessage(
  company: Company | null | undefined,
): string {
  return billingAccessMessage(company);
}

/** Flip expired local trials to canceled so billing UI is consistent. */
export async function expireStaleTrial(
  company: Company | null | undefined,
): Promise<Company | null | undefined> {
  if (!company || !isLocalTrialExpired(company)) return company;
  return prisma.company.update({
    where: { id: company.id },
    data: { subscriptionStatus: "canceled" },
  });
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
