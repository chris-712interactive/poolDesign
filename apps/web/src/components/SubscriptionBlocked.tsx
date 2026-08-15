import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import type { SessionUser } from "@/lib/auth";
import { subscriptionAccessMessage } from "@/lib/subscription";

export function SubscriptionBlocked({ user }: { user: SessionUser }) {
  const message = subscriptionAccessMessage(user.company);
  const isAdmin = user.role === "company_admin";
  const trialEnded = !user.company?.stripeCustomerId;

  return (
    <div className="app-shell">
      <AppHeader user={user} />
      <main className="page" style={{ maxWidth: 560 }}>
        <div className="panel stack">
          <h1>{trialEnded ? "Trial ended" : "Subscription required"}</h1>
          <p>{message || "Your company does not have active access."}</p>
          {isAdmin ? (
            <Link className="btn" href="/app/admin">
              Choose a plan
            </Link>
          ) : (
            <p className="muted">
              Ask your company admin to subscribe to Sales or Builder to restore
              access.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
