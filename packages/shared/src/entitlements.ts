/**
 * Sales vs Builder plan entitlements.
 * DB still stores planKey as "starter" | "pro"; tiers are the product names.
 */

import { isLocalTrialActive } from "./billing";

export type PlanKey = "starter" | "pro";
export type PlanTier = "sales" | "builder";

export type PlanEntitlements = {
  /** Kitchen-table live client session (finish swaps) */
  liveClientSession: boolean;
  /** Branded PDF / print quote from takeoff */
  pdfQuote: boolean;
  /** CSV takeoff export for estimators */
  csvTakeoff: boolean;
  /** Company estimate recipe: bind prices to plan quantities */
  estimateRecipe: boolean;
  /** Draft (non-stamped) permit plan packet */
  permitPacket: boolean;
  /** Import AR / phone grade-walk samples into the design */
  arGradeImport: boolean;
  /** Unlimited HQ PNG / orbit clip exports */
  hqExportUnlimited: boolean;
};

export const PLAN_TIER_LABELS: Record<PlanTier, string> = {
  sales: "Sales",
  builder: "Builder",
};

export const PLAN_KEY_TO_TIER: Record<PlanKey, PlanTier> = {
  starter: "sales",
  pro: "builder",
};

export const ENTITLEMENTS_BY_TIER: Record<PlanTier, PlanEntitlements> = {
  sales: {
    liveClientSession: true,
    pdfQuote: false,
    csvTakeoff: false,
    estimateRecipe: false,
    permitPacket: false,
    arGradeImport: false,
    hqExportUnlimited: false,
  },
  builder: {
    liveClientSession: true,
    pdfQuote: true,
    csvTakeoff: true,
    estimateRecipe: true,
    permitPacket: true,
    arGradeImport: true,
    hqExportUnlimited: true,
  },
};

export function normalizePlanKey(planKey: string | null | undefined): PlanKey {
  return planKey === "pro" ? "pro" : "starter";
}

export function planTierForKey(planKey: string | null | undefined): PlanTier {
  return PLAN_KEY_TO_TIER[normalizePlanKey(planKey)];
}

export type CompanyEntitlementInput = {
  planKey?: string | null;
  subscriptionStatus?: string | null;
  trialEndsAt?: Date | string | null;
};

/**
 * Resolve entitlements for a company.
 * Active local trials get Builder features so teams can evaluate the full product.
 */
export function entitlementsForCompany(
  company: CompanyEntitlementInput | null | undefined,
): PlanEntitlements {
  if (!company) {
    return ENTITLEMENTS_BY_TIER.builder;
  }
  if (isLocalTrialActive(company)) {
    return ENTITLEMENTS_BY_TIER.builder;
  }
  return ENTITLEMENTS_BY_TIER[planTierForKey(company.planKey)];
}

export function planDisplayName(planKey: string | null | undefined): string {
  return PLAN_TIER_LABELS[planTierForKey(planKey)];
}

export type EntitlementKey = keyof PlanEntitlements;

export function companyHasEntitlement(
  company: CompanyEntitlementInput | null | undefined,
  key: EntitlementKey,
): boolean {
  return entitlementsForCompany(company)[key];
}
