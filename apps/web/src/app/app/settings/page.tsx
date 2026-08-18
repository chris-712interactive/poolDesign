import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { AppHeader } from "@/components/AppHeader";
import { AccountSettingsClient } from "@/components/AccountSettingsClient";
import {
  parseAccountSection,
  type AccountSection,
} from "@/lib/accountSections";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { section } = await searchParams;
  const showUnits = user.role !== "platform_owner";
  const allowed: AccountSection[] = showUnits
    ? ["profile", "units", "password"]
    : ["profile", "password"];

  return (
    <div className="app-shell">
      <AppHeader user={user} />
      <main className="page">
        <AccountSettingsClient
          userId={user.id}
          showUnits={showUnits}
          initialSection={parseAccountSection(section, allowed)}
          initialProfile={{
            name: user.name,
            email: user.email,
            role: user.role,
            companyName: user.company?.name ?? null,
            alsoDesigner: user.alsoDesigner === true,
            unitSystem: user.unitSystem,
          }}
        />
      </main>
    </div>
  );
}
