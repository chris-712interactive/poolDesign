import { redirect, unstable_rethrow } from "next/navigation";
import { getSessionUser, setSessionCookie } from "@/lib/auth";
import { createTrialCompany } from "@/lib/signup";
import { AppHeader } from "@/components/AppHeader";
import { TRIAL_DURATION_DAYS } from "@pool-design/shared";
import Link from "next/link";

async function signupAction(formData: FormData) {
  "use server";
  const result = await createTrialCompany({
    companyName: String(formData.get("companyName") || ""),
    name: String(formData.get("name") || ""),
    email: String(formData.get("email") || ""),
    password: String(formData.get("password") || ""),
    website: String(formData.get("faxNumber") || ""),
  });
  if (!result.ok) {
    redirect(`/signup?error=${encodeURIComponent(result.error)}`);
  }
  try {
    await setSessionCookie(result.userId);
    redirect("/app");
  } catch (err) {
    unstable_rethrow(err);
    console.error("signup session failed", err);
    redirect("/signup?error=Could not start your session. Try signing in.");
  }
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getSessionUser();
  if (user) {
    if (user.role === "platform_owner") redirect("/platform");
    redirect("/app");
  }
  const params = await searchParams;
  const error = params.error ? decodeURIComponent(params.error) : null;

  return (
    <div className="app-shell">
      <AppHeader user={null} />
      <main className="page" style={{ maxWidth: 520, margin: "0 auto" }}>
        <div className="panel stack">
          <h1>Start your {TRIAL_DURATION_DAYS}-day trial</h1>
          <p className="muted">
            No credit card. Your company gets full Builder features for{" "}
            {TRIAL_DURATION_DAYS} days. Subscribe to Sales or Builder through
            Stripe when you are ready.
          </p>
          {error ? <p className="error">{error}</p> : null}
          <form action={signupAction} className="stack">
            <div className="signup-honeypot" aria-hidden="true">
              <label htmlFor="faxNumber">Company fax</label>
              <input id="faxNumber" name="faxNumber" tabIndex={-1} autoComplete="off" />
            </div>
            <div className="field">
              <label htmlFor="companyName">Company name</label>
              <input
                id="companyName"
                name="companyName"
                required
                minLength={2}
                autoComplete="organization"
              />
            </div>
            <div className="field">
              <label htmlFor="name">Your name</label>
              <input id="name" name="name" required autoComplete="name" />
            </div>
            <div className="field">
              <label htmlFor="email">Work email</label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
              />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <button className="btn" type="submit">
              Create company trial
            </button>
          </form>
          <p className="muted">
            Already have an account? <Link href="/login">Sign in</Link>
          </p>
          <p className="muted" style={{ fontSize: "0.85rem" }}>
            By starting a trial you agree to the{" "}
            <Link href="/terms">Terms</Link> and{" "}
            <Link href="/privacy">Privacy Policy</Link>.
          </p>
        </div>
      </main>
    </div>
  );
}
