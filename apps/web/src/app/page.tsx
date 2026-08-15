import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { AppHeader } from "@/components/AppHeader";
import {
  formatMoney,
  PLAN_MARKETING,
  PLAN_PRICING,
  TRIAL_DURATION_DAYS,
} from "@pool-design/shared";

const FEATURES = [
  {
    title: "Design in plan and 3D",
    body: "Draw pools, spas, patio, fence, and equipment with field-ready precision. Walk the job in 3D before you pour.",
  },
  {
    title: "Close at the kitchen table",
    body: "Share a client link. Host a live finish session so homeowners swap tile and patio while you watch.",
  },
  {
    title: "Takeoffs that match the drawing",
    body: "Material lists and company price books stay attached to the design — not a disconnected spreadsheet.",
  },
  {
    title: "Quotes and draft packets",
    body: "Builder plans export branded PDF quotes, CSV takeoffs, and a draft permit packet. Never marketed as PE-stamped.",
  },
] as const;

const STEPS = [
  {
    n: "1",
    title: "Start a company trial",
    body: `Create your company in a minute. No card. ${TRIAL_DURATION_DAYS} days of full Builder features.`,
  },
  {
    n: "2",
    title: "Design a real job",
    body: "Invite designers, set your price book, and build the next backyard or commercial pool in CAD + 3D.",
  },
  {
    n: "3",
    title: "Subscribe when it sticks",
    body: "Pick Sales or Builder. Stripe handles the card and invoices — the trial never touches Stripe.",
  },
] as const;

export default async function HomePage() {
  const user = await getSessionUser();
  const appHref =
    user?.role === "platform_owner" ? "/platform" : user ? "/app" : "/signup";

  return (
    <div className="app-shell marketing">
      <AppHeader user={user} />
      <main>
        <section className="hero marketing-hero">
          <p className="marketing-kicker">For pool companies</p>
          <h1>Sell and build water with one drawing.</h1>
          <p className="hero-lede">
            PoolShape is CAD, 3D, takeoffs, and client proposals for builders
            who close in the backyard — not a generic drafting tool.
          </p>
          <p>
            {TRIAL_DURATION_DAYS}-day company trial. No credit card. Full
            Builder features while you evaluate, then Sales or Builder on
            Stripe.
          </p>
          <div className="row" style={{ marginTop: "1.5rem" }}>
            <Link className="btn" href={appHref}>
              {user ? "Open workspace" : "Start free trial"}
            </Link>
            {!user ? (
              <Link className="btn ghost" href="/login">
                Sign in
              </Link>
            ) : null}
          </div>
        </section>

        <section id="features" className="marketing-section">
          <div className="marketing-inner">
            <h2>Built for the sales cycle and the job</h2>
            <p className="muted marketing-lead">
              Residential, commercial, and water-park levels in one company
              account. Your team designs. Homeowners review. Estimating stays
              on the same model.
            </p>
            <div className="grid-2 marketing-feature-grid">
              {FEATURES.map((f) => (
                <article key={f.title} className="panel stack">
                  <h3>{f.title}</h3>
                  <p className="muted" style={{ margin: 0 }}>
                    {f.body}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="marketing-section">
          <div className="marketing-inner">
            <h2>How a trial works</h2>
            <div className="grid-3">
              {STEPS.map((s) => (
                <article key={s.n} className="panel stack">
                  <span className="marketing-step">{s.n}</span>
                  <h3>{s.title}</h3>
                  <p className="muted" style={{ margin: 0 }}>
                    {s.body}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="marketing-section">
          <div className="marketing-inner">
            <h2>Company plans</h2>
            <p className="muted marketing-lead">
              One subscription per company. Trial is on us; paid plans bill
              through Stripe after you subscribe. Usage credits for extra HQ
              exports can come later — they are not required to start.
            </p>
            <div className="grid-2">
              <article className="panel stack marketing-plan">
                <h3>{PLAN_MARKETING.sales.name}</h3>
                <p className="marketing-price">
                  {formatMoney(PLAN_PRICING.sales.monthlyCents)}
                  <span>/mo</span>
                </p>
                <p className="muted">{PLAN_MARKETING.sales.blurb}</p>
                <ul className="marketing-list">
                  {PLAN_MARKETING.sales.highlights.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
                <Link className="btn secondary" href="/signup">
                  Start trial
                </Link>
              </article>
              <article className="panel stack marketing-plan marketing-plan-featured">
                <p className="marketing-plan-tag">Included in the trial</p>
                <h3>{PLAN_MARKETING.builder.name}</h3>
                <p className="marketing-price">
                  {formatMoney(PLAN_PRICING.builder.monthlyCents)}
                  <span>/mo</span>
                </p>
                <p className="muted">{PLAN_MARKETING.builder.blurb}</p>
                <ul className="marketing-list">
                  {PLAN_MARKETING.builder.highlights.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
                <Link className="btn" href="/signup">
                  Start trial
                </Link>
              </article>
            </div>
          </div>
        </section>

        <section className="marketing-section">
          <div className="marketing-inner panel stack" style={{ textAlign: "center" }}>
            <h2>Ready for the next backyard?</h2>
            <p className="muted">
              No card to start. Subscribe only when the team is using it.
            </p>
            <div className="row" style={{ justifyContent: "center" }}>
              <Link className="btn" href="/signup">
                Start {TRIAL_DURATION_DAYS}-day trial
              </Link>
              <Link className="btn secondary" href="/login">
                Sign in
              </Link>
            </div>
          </div>
        </section>
      </main>
      <footer className="marketing-footer">
        <span>PoolShape</span>
        <nav>
          <Link href="/#features">Features</Link>
          <Link href="/#pricing">Pricing</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/login">Sign in</Link>
        </nav>
      </footer>
    </div>
  );
}
