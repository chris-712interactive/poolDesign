import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@pool-design/db";
import { USER_ROLE_LABELS, type UserRole } from "@pool-design/shared";
import { getSessionUser, setSessionCookie } from "@/lib/auth";
import { AppHeader } from "@/components/AppHeader";

const MIN_PASSWORD = 8;

function roleLabel(role: string): string {
  return USER_ROLE_LABELS[role as UserRole] ?? role;
}

async function updateProfileAction(formData: FormData) {
  "use server";
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "")
    .toLowerCase()
    .trim();
  if (!name) {
    redirect("/app/settings?error=" + encodeURIComponent("Enter your name."));
  }
  if (!email || !email.includes("@")) {
    redirect("/app/settings?error=" + encodeURIComponent("Enter a valid email."));
  }

  if (email !== user.email) {
    const taken = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (taken && taken.id !== user.id) {
      redirect(
        "/app/settings?error=" +
          encodeURIComponent("That email is already in use."),
      );
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { name, email },
  });
  revalidatePath("/app/settings");
  redirect("/app/settings?saved=profile");
}

async function updateUnitsAction(formData: FormData) {
  "use server";
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "platform_owner") redirect("/app/settings");

  const unitSystem = String(formData.get("unitSystem") || "imperial");
  if (unitSystem !== "imperial" && unitSystem !== "metric") {
    redirect("/app/settings");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { unitSystem },
  });
  revalidatePath("/app/settings");
  revalidatePath("/app");
  redirect("/app/settings?saved=units");
}

async function updatePasswordAction(formData: FormData) {
  "use server";
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const current = String(formData.get("currentPassword") || "");
  const next = String(formData.get("newPassword") || "");
  const confirm = String(formData.get("confirmPassword") || "");

  const fail = (message: string) =>
    redirect("/app/settings?error=" + encodeURIComponent(message));

  if (!current || !next || !confirm) {
    fail("Fill in all password fields.");
  }
  if (next.length < MIN_PASSWORD) {
    fail(`New password must be at least ${MIN_PASSWORD} characters.`);
  }
  if (next !== confirm) {
    fail("New password and confirmation do not match.");
  }

  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  if (!row) redirect("/login");

  const ok = await bcrypt.compare(current, row.passwordHash);
  if (!ok) fail("Current password is incorrect.");

  const passwordHash = await bcrypt.hash(next, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });
  await setSessionCookie(user.id);
  revalidatePath("/app/settings");
  redirect("/app/settings?saved=password");
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const error = params.error ? decodeURIComponent(params.error) : null;
  const saved =
    params.saved === "profile"
      ? "Account details saved."
      : params.saved === "units"
        ? "Units saved."
        : params.saved === "password"
          ? "Password updated."
          : null;

  const companyStaff = user.role !== "platform_owner";

  return (
    <div className="app-shell">
      <AppHeader user={user} />
      <main className="page stack account-page" style={{ maxWidth: 560 }}>
        <div>
          <h1 style={{ margin: 0 }}>Account</h1>
          <p className="muted" style={{ margin: "0.35rem 0 0" }}>
            Your sign-in details and preferences for this login.
          </p>
        </div>

        {error ? <p className="error">{error}</p> : null}
        {saved ? <p className="success">{saved}</p> : null}

        <div className="panel stack">
          <h2>Profile</h2>
          <dl className="account-meta">
            <div>
              <dt>Role</dt>
              <dd>{roleLabel(user.role)}</dd>
            </div>
            {user.company ? (
              <div>
                <dt>Company</dt>
                <dd>{user.company.name}</dd>
              </div>
            ) : null}
            {user.role === "company_admin" ? (
              <div>
                <dt>Designer seat</dt>
                <dd>{user.alsoDesigner ? "Yes — you can open CAD" : "No"}</dd>
              </div>
            ) : null}
          </dl>
          <form action={updateProfileAction} className="stack">
            <div className="field">
              <label htmlFor="name">Name</label>
              <input
                id="name"
                name="name"
                required
                defaultValue={user.name}
                autoComplete="name"
              />
            </div>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                required
                defaultValue={user.email}
                autoComplete="email"
              />
            </div>
            <button className="btn" type="submit">
              Save profile
            </button>
          </form>
        </div>

        {companyStaff ? (
          <div className="panel stack">
            <h2>Units</h2>
            <p className="muted" style={{ margin: 0 }}>
              Your preference across projects. Geometry is stored canonically
              so teammates can use either system.
            </p>
            <form action={updateUnitsAction} className="stack">
              <div className="field">
                <label htmlFor="unitSystem">Units of measure</label>
                <select
                  id="unitSystem"
                  name="unitSystem"
                  defaultValue={user.unitSystem}
                >
                  <option value="imperial">
                    Imperial (ft / in, snap 1/32&quot;)
                  </option>
                  <option value="metric">Metric (m / cm / mm, snap 1 mm)</option>
                </select>
              </div>
              <button className="btn" type="submit">
                Save units
              </button>
            </form>
          </div>
        ) : null}

        <div className="panel stack">
          <h2>Password</h2>
          <p className="muted" style={{ margin: 0 }}>
            Choose a new password for this account. You will stay signed in.
          </p>
          <form action={updatePasswordAction} className="stack">
            <div className="field">
              <label htmlFor="currentPassword">Current password</label>
              <input
                id="currentPassword"
                name="currentPassword"
                type="password"
                required
                autoComplete="current-password"
              />
            </div>
            <div className="field">
              <label htmlFor="newPassword">New password</label>
              <input
                id="newPassword"
                name="newPassword"
                type="password"
                required
                minLength={MIN_PASSWORD}
                autoComplete="new-password"
              />
            </div>
            <div className="field">
              <label htmlFor="confirmPassword">Confirm new password</label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                minLength={MIN_PASSWORD}
                autoComplete="new-password"
              />
            </div>
            <button className="btn" type="submit">
              Update password
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
