import { redirect, unstable_rethrow } from "next/navigation";
import { authenticate, getSessionUser, setSessionCookie } from "@/lib/auth";
import { AppHeader } from "@/components/AppHeader";

async function loginAction(formData: FormData) {
  "use server";
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  try {
    const user = await authenticate(email, password);
    if (!user) {
      redirect("/login?error=1");
    }
    await setSessionCookie(user.id);
    if (user.role === "platform_owner") redirect("/platform");
    redirect("/app");
  } catch (err) {
    unstable_rethrow(err);
    console.error("login failed", err);
    redirect("/login?error=db");
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  let user = null;
  try {
    user = await getSessionUser();
  } catch (err) {
    console.error("session lookup failed", err);
  }
  if (user) {
    if (user.role === "platform_owner") redirect("/platform");
    redirect("/app");
  }
  const params = await searchParams;

  return (
    <div className="app-shell">
      <AppHeader user={null} />
      <main className="page" style={{ maxWidth: 480, margin: "0 auto" }}>
        <div className="panel stack">
          <h1>Sign in</h1>
          <p className="muted">
            Use a seeded demo account, or your company credentials.
          </p>
          {params.error === "1" && (
            <p className="error">Invalid email or password.</p>
          )}
          {params.error === "db" && (
            <p className="error">
              Could not reach the database. Confirm{" "}
              <code>DATABASE_URL</code> is set in Vercel, then run{" "}
              <code>pnpm db:push</code> and <code>pnpm db:seed</code> against
              that database. Check{" "}
              <a href="/api/health">/api/health</a> and Vercel function logs.
            </p>
          )}
          <form action={loginAction} className="stack">
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                required
                defaultValue="designer@acme-pools.test"
              />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                required
                defaultValue="password123"
              />
            </div>
            <button className="btn" type="submit">
              Sign in
            </button>
          </form>
          <div className="muted" style={{ fontSize: "0.9rem" }}>
            <div>owner@poolshape.com</div>
            <div>admin@acme-pools.test</div>
            <div>designer@acme-pools.test</div>
            <div>password: password123</div>
          </div>
        </div>
      </main>
    </div>
  );
}
