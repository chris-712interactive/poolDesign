import Link from "next/link";
import type { SessionUser } from "@/lib/auth";
import { isLocalTrialActive, trialDaysRemaining } from "@pool-design/shared";

export function AppHeader({ user }: { user: SessionUser | null }) {
  const trialDays = user?.company
    ? trialDaysRemaining(user.company)
    : null;
  const showTrial = Boolean(
    user?.role === "company_admin" &&
      user.company &&
      isLocalTrialActive(user.company),
  );

  return (
    <>
      <header className="topbar">
        <Link href="/" className="brand">
          <img
            src="/brand/mark.svg"
            alt=""
            width={28}
            height={28}
            className="brand-mark"
          />
          PoolShape
        </Link>
        <nav>
          {user?.role === "platform_owner" && (
            <Link href="/platform">Owner console</Link>
          )}
          {user?.companyId && (
            <>
              <Link href="/app">Projects</Link>
              <Link href="/app/settings">Settings</Link>
              {user.role === "company_admin" && (
                <Link href="/app/admin">Company admin</Link>
              )}
            </>
          )}
          {user ? (
            <>
              <span className="muted" style={{ color: "rgba(255,255,255,0.7)" }}>
                {user.name}
              </span>
              <form action="/api/auth/logout" method="post">
                <button className="btn ghost" type="submit">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <a href="/#features">Features</a>
              <a href="/#pricing">Pricing</a>
              <Link href="/login">Sign in</Link>
              <Link className="btn" href="/signup">
                Start free trial
              </Link>
            </>
          )}
        </nav>
      </header>
      {showTrial && trialDays != null ? (
        <div className="trial-banner">
          {trialDays === 0
            ? "Your trial ends today."
            : `${trialDays} day${trialDays === 1 ? "" : "s"} left in your trial.`}{" "}
          <Link href="/app/admin">Choose Sales or Builder</Link>
        </div>
      ) : null}
    </>
  );
}
