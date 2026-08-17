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
    <div className="app-chrome">
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
              {user.role === "company_admin" && (
                <Link href="/app/admin">Company admin</Link>
              )}
            </>
          )}
          {user ? (
            <>
              <Link href="/app/settings">Account</Link>
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
              <a href="/#product">Product</a>
              <a href="/#plans">Plans</a>
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
          <Link href="/app/admin?section=billing">Choose Sales or Builder</Link>
        </div>
      ) : null}
    </div>
  );
}
