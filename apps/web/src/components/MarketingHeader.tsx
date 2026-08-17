import Link from "next/link";
import type { SessionUser } from "@/lib/auth";

export function MarketingHeader({ user }: { user: SessionUser | null }) {
  const appHref =
    user?.role === "platform_owner" ? "/platform" : user ? "/app" : "/signup";

  return (
    <header className="mkt-header">
      <div className="mkt-header-inner">
        <Link href="/" className="mkt-brand">
          <img
            src="/brand/mark.svg"
            alt=""
            width={32}
            height={32}
            className="mkt-brand-mark"
          />
          PoolShape
        </Link>
        <nav className="mkt-nav" aria-label="Primary">
          <a href="/#product">Product</a>
          <a href="/#workflow">Workflow</a>
          <a href="/#plans">Plans</a>
          {user ? (
            <Link className="mkt-nav-cta" href={appHref}>
              Open workspace
            </Link>
          ) : (
            <>
              <Link href="/login">Sign in</Link>
              <Link className="mkt-nav-cta" href="/signup">
                Start a company trial
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
