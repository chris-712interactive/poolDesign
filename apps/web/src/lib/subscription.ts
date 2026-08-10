import type { Company, SubscriptionStatus } from "@pool-design/db";

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
