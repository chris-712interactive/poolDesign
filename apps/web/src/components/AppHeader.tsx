import Link from "next/link";
import type { SessionUser } from "@/lib/auth";

export function AppHeader({ user }: { user: SessionUser | null }) {
  return (
    <header className="topbar">
      <Link href="/" className="brand">
        <img
          src="/brand/mark.png"
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
          <Link className="btn ghost" href="/login">
            Sign in
          </Link>
        )}
      </nav>
    </header>
  );
}
