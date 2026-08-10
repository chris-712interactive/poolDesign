import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { AppHeader } from "@/components/AppHeader";

export default async function HomePage() {
  const user = await getSessionUser();
  const href =
    user?.role === "platform_owner"
      ? "/platform"
      : user
        ? "/app"
        : "/login";

  return (
    <div className="app-shell">
      <AppHeader user={user} />
      <main>
        <section className="hero">
          <h1>PoolShape</h1>
          <p className="hero-lede">
            Built for companies that sell and build water.
          </p>
          <p>
            Draw residential, commercial, and water-park projects with field-ready
            precision, generate material lists, share designs with clients, and
            manage contracts — online or offline.
          </p>
          <div className="row" style={{ marginTop: "1.5rem" }}>
            <Link className="btn" href={href}>
              {user ? "Open workspace" : "Sign in to workspace"}
            </Link>
            <Link className="btn ghost" href="/login">
              Demo accounts
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
