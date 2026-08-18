import { Suspense } from "react";
import Link from "next/link";
import type { SessionUser } from "@/lib/auth";
import { isLocalTrialActive, trialDaysRemaining } from "@pool-design/shared";
import { OnboardingTour } from "@/components/OnboardingTour";

export function AppHeader({
  user,
  compact = false,
}: {
  user: SessionUser | null;
  compact?: boolean;
}) {
  const trialDays = user?.company
    ? trialDaysRemaining(user.company)
    : null;
  const showTrial = Boolean(
    user?.role === "company_admin" &&
      user.company &&
      isLocalTrialActive(user.company),
  );

  return (
    <div className={`app-chrome${compact ? " app-chrome-cad" : ""}`}>
      <header className={`topbar${compact ? " topbar-cad" : ""}`}>
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
              <Link href="/app" data-tour="nav-projects">
                Projects
              </Link>
              {user.role === "company_admin" && (
                <Link href="/app/admin" data-tour="nav-admin">
                  Company admin
                </Link>
              )}
            </>
          )}
          {user ? (
            <>
              <Link href="/app/settings" data-tour="nav-account">
                Account
              </Link>
              {!compact ? (
                <span className="muted" style={{ color: "rgba(255,255,255,0.7)" }}>
                  {user.name}
                </span>
              ) : null}
              {showTrial && compact && trialDays != null ? (
                <Link href="/app/admin?section=billing" className="trial-chip">
                  {trialDays === 0
                    ? "Trial ends today"
                    : `${trialDays}d trial`}
                </Link>
              ) : null}
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
      {showTrial && trialDays != null && !compact ? (
        <div className="trial-banner">
          {trialDays === 0
            ? "Your trial ends today."
            : `${trialDays} day${trialDays === 1 ? "" : "s"} left in your trial.`}{" "}
          <Link href="/app/admin?section=billing">Choose Sales or Builder</Link>
        </div>
      ) : null}
      {user?.companyId && user.role !== "platform_owner" ? (
        <Suspense fallback={null}>
          <OnboardingTour
            userId={user.id}
            role={user.role}
            alsoDesigner={user.alsoDesigner === true}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
