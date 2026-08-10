import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import type { SessionUser } from "@/lib/auth";
import { subscriptionAccessMessage } from "@/lib/subscription";

export function SubscriptionBlocked({ user }: { user: SessionUser }) {
  const status = user.company?.subscriptionStatus ?? "canceled";
  const message = subscriptionAccessMessage(status);
  const isAdmin = user.role === "company_admin";

  return (
    <div className="app-shell">
      <AppHeader user={user} />
      <main className="page" style={{ maxWidth: 560 }}>
        <div className="panel stack">
          <h1>Subscription required</h1>
          <p>{message || "Your company does not have active access."}</p>
          {isAdmin ? (
            <Link className="btn" href="/app/admin">
              Manage billing
            </Link>
          ) : (
            <p className="muted">
              Ask your company admin to renew billing to restore access.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
