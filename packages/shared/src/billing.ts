/**
 * Company billing: local no-card trial, then Stripe for paid Sales/Builder.
 * Stripe Checkout must never use trial_period_days — we own the trial clock.
 * Extra designer seats are not billed during trial; they attach to Sales/Builder
 * Checkout from the current designer count (one seat included).
 */

import type { PlanKey, PlanTier } from "./entitlements";

export const TRIAL_DURATION_DAYS = 14;

/** Display list prices. Stripe Price IDs in env are what actually charge. */
export const PLAN_PRICING: Record<
  PlanTier,
  { planKey: PlanKey; monthlyCents: number }
> = {
  sales: { planKey: "starter", monthlyCents: 4900 },
  builder: { planKey: "pro", monthlyCents: 9900 },
};

export const PLAN_MARKETING: Record<
  PlanTier,
  { name: string; blurb: string; highlights: readonly string[] }
> = {
  sales: {
    name: "Sales",
    blurb: "Close the backyard at the kitchen table.",
    highlights: [
      "CAD + 3D walkthrough",
      "Finishes and object library",
      "Client share links",
      "Live finish sessions",
    ],
  },
  builder: {
    name: "Builder",
    blurb: "Design through takeoff and draft construction docs.",
    highlights: [
      "Everything in Sales",
      "Branded PDF quotes",
      "CSV takeoffs and price book",
      "Draft permit packet (not PE-stamped)",
      "Phone grade import",
    ],
  },
};

export type BillingCompanyInput = {
  subscriptionStatus?: string | null;
  trialEndsAt?: Date | string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
};

export function trialEndsAtFrom(now: Date = new Date()): Date {
  return new Date(now.getTime() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000);
}

export function parseTrialEnd(
  trialEndsAt: Date | string | null | undefined,
): Date | null {
  if (!trialEndsAt) return null;
  const d = trialEndsAt instanceof Date ? trialEndsAt : new Date(trialEndsAt);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Local trial still running — independent of Stripe. */
export function isLocalTrialActive(
  company: BillingCompanyInput | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!company || company.subscriptionStatus !== "trialing") return false;
  const ends = parseTrialEnd(company.trialEndsAt);
  if (!ends) return false;
  return ends.getTime() > now.getTime();
}

export function isLocalTrialExpired(
  company: BillingCompanyInput | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!company || company.subscriptionStatus !== "trialing") return false;
  const ends = parseTrialEnd(company.trialEndsAt);
  if (!ends) return true;
  return ends.getTime() <= now.getTime();
}

/**
 * Whole days remaining, rounded up. 0 on the last calendar day still in trial.
 */
export function trialDaysRemaining(
  company: BillingCompanyInput | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!company || !isLocalTrialActive(company, now)) return null;
  const ends = parseTrialEnd(company.trialEndsAt);
  if (!ends) return null;
  const ms = ends.getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

const BLOCKED_STATUSES = new Set(["canceled", "suspended"]);

/**
 * CAD/project access. Admins can still reach billing when this is false.
 * Expired local trials are blocked even if status has not been flipped yet.
 */
export function companyHasAppAccess(
  company: BillingCompanyInput | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!company) return true;
  if (BLOCKED_STATUSES.has(company.subscriptionStatus ?? "")) return false;
  if (isLocalTrialExpired(company, now)) return false;
  return true;
}

export function subscriptionAccessMessage(
  company: BillingCompanyInput | null | undefined,
  now: Date = new Date(),
): string {
  const status = company?.subscriptionStatus ?? "canceled";
  if (isLocalTrialExpired(company, now) || (status === "canceled" && !company?.stripeCustomerId)) {
    return "Your trial has ended. Choose Sales or Builder to keep designing — billing is handled by Stripe after you pick a plan.";
  }
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

export function slugifyCompanyName(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return slug || "company";
}
