import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { AppHeader } from "@/components/AppHeader";
import { SetupWizardClient } from "@/components/SetupWizardClient";
import { needsCompanySetup } from "@pool-design/shared";
import { companyHasAppAccess } from "@/lib/subscription";
import { SubscriptionBlocked } from "@/components/SubscriptionBlocked";

export default async function SetupPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "platform_owner") redirect("/platform");
  if (user.role !== "company_admin" || !user.company) redirect("/app");
  if (!needsCompanySetup(user)) redirect("/app");

  if (!companyHasAppAccess(user.company)) {
    return <SubscriptionBlocked user={user} />;
  }

  return (
    <div className="app-shell">
      <AppHeader user={user} />
      <main className="page">
        <SetupWizardClient companyName={user.company.name} />
      </main>
    </div>
  );
}
