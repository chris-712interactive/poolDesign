import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@pool-design/db";
import { getSessionUser } from "@/lib/auth";
import { AppHeader } from "@/components/AppHeader";
import { needsCompanySetup } from "@pool-design/shared";

async function updateSettingsAction(formData: FormData) {
  "use server";
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const unitSystem = String(formData.get("unitSystem") || "imperial");
  if (unitSystem !== "imperial" && unitSystem !== "metric") redirect("/app/settings");

  await prisma.user.update({
    where: { id: user.id },
    data: { unitSystem },
  });

  revalidatePath("/app/settings");
  revalidatePath("/app");
}

export default async function SettingsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "platform_owner") redirect("/platform");
  if (needsCompanySetup(user)) redirect("/app/setup");

  return (
    <div className="app-shell">
      <AppHeader user={user} />
      <main className="page" style={{ maxWidth: 560 }}>
        <div className="panel stack">
          <h1>Designer settings</h1>
          <p className="muted">
            Measurement units are your preference and apply across projects.
            Geometry is stored canonically so teammates can use either system.
          </p>
          <form action={updateSettingsAction} className="stack">
            <div className="field">
              <label htmlFor="unitSystem">Units of measure</label>
              <select
                id="unitSystem"
                name="unitSystem"
                defaultValue={user.unitSystem}
              >
                <option value="imperial">Imperial (ft / in, snap 1/32&quot;)</option>
                <option value="metric">Metric (m / cm / mm, snap 1 mm)</option>
              </select>
            </div>
            <button className="btn" type="submit">
              Save settings
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
