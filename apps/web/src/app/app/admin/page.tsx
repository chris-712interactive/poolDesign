import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { AppHeader } from "@/components/AppHeader";
import { CompanyAdminClient } from "@/components/CompanyAdminClient";
import { companyHasAppAccess } from "@/lib/subscription";

export default async function CompanyAdminPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "company_admin") redirect("/app");
  if (!user.company) redirect("/login");

  // Admins may always reach billing to renew; other admin tools still load.
  const company = user.company;
  const rootDomain =
    process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost:3000";

  return (
    <div className="app-shell">
      <AppHeader user={user} />
      <main className="page stack">
        {!companyHasAppAccess(company) ? (
          <div className="panel">
            <p>
              Access to projects is paused until billing is active. You can still
              manage subscription below.
            </p>
          </div>
        ) : null}
        <CompanyAdminClient
          initialProfile={{
            name: company.name,
            logoUrl: company.logoUrl,
            region: company.region,
            defaultUnitSystem: company.defaultUnitSystem,
            slug: company.slug,
          }}
          billing={{
            planKey: company.planKey,
            status: company.subscriptionStatus,
            hasCustomer: Boolean(company.stripeCustomerId),
            stripeCustomerId: company.stripeCustomerId,
            trialEndsAt: company.trialEndsAt?.toISOString() ?? null,
          }}
          rootDomain={rootDomain}
        />
      </main>
    </div>
  );
}
