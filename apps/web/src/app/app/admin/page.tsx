import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { AppHeader } from "@/components/AppHeader";
import { DESIGN_LEVEL_LABELS } from "@pool-design/shared";

export default async function CompanyAdminPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "company_admin") redirect("/app");
  if (!user.company) redirect("/login");

  const company = user.company;
  const levels = company.enabledDesignLevels.split(",");

  return (
    <div className="app-shell">
      <AppHeader user={user} />
      <main className="page stack">
        <div className="panel">
          <h1>Company admin</h1>
          <p className="muted">
            Billing, branding, domains, and Connect onboarding will plug in here.
            Core tenant settings are already wired.
          </p>
        </div>
        <div className="grid-2">
          <div className="panel stack">
            <h2>Tenant</h2>
            <div>
              <strong>Subdomain</strong>
              <div className="muted">{company.slug}.localhost:3000</div>
            </div>
            <div>
              <strong>Custom domain</strong>
              <div className="muted">
                {company.customDomain || "Not configured"}
              </div>
            </div>
            <div>
              <strong>Default units</strong>
              <div className="muted">{company.defaultUnitSystem}</div>
            </div>
            <div>
              <strong>Enabled design levels</strong>
              <div className="row">
                {levels.map((level) => (
                  <span className="badge" key={level}>
                    {DESIGN_LEVEL_LABELS[level as keyof typeof DESIGN_LEVEL_LABELS] ||
                      level}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="panel stack">
            <h2>Billing & payments</h2>
            <div>
              <strong>Subscription</strong>
              <div className="muted">
                {company.planKey} · {company.subscriptionStatus}
              </div>
            </div>
            <div>
              <strong>Stripe customer</strong>
              <div className="muted">
                {company.stripeCustomerId || "Not connected yet"}
              </div>
            </div>
            <div>
              <strong>Stripe Connect (optional card pay)</strong>
              <div className="muted">
                {company.stripeConnectId ||
                  "Optional — cash, check, and loan tracking work without Connect"}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
