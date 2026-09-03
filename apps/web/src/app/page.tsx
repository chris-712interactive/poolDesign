import Image from "next/image";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { MarketingFooter } from "@/components/MarketingFooter";
import { MarketingHeader } from "@/components/MarketingHeader";
import { MarketingPlanGraphic } from "@/components/MarketingPlanGraphic";
import {
  DESIGNER_SEAT_MONTHLY_CENTS,
  formatMoney,
  INCLUDED_DESIGNER_SEATS,
  PLAN_MARKETING,
  PLAN_PRICING,
  TRIAL_DURATION_DAYS,
} from "@pool-design/shared";

const CAPABILITIES = [
  "Construction-true plan CAD",
  "3D walkthrough",
  "Live client finish sessions",
  "Takeoff from the model",
  "Branded proposals",
] as const;

const PLAN_SEATS = [
  {
    label: "Designer licenses",
    value: `${INCLUDED_DESIGNER_SEATS} included`,
  },
  {
    label: "Additional designers",
    value: `${formatMoney(DESIGNER_SEAT_MONTHLY_CENTS)}/month each`,
  },
  {
    label: "Admin & estimator",
    value: "Unlimited",
  },
] as const;

const CHAPTERS = [
  {
    id: "plan",
    kicker: "01  /  Design",
    title: "Draw the vessel the way you will build it.",
    body: "Pool, spa, deck, fence, and equipment live in one plan. Vertex, bulge, and dimension tools stay in millimeters so the drawing remains construction-true whether your team works in feet or meters.",
    points: [
      "Freeform and geometric vessels, steps, benches, and waterline",
      "Site lines, patio, and structure without a generic CAD tax",
      "Survey underlay so the backyard sits on the sheet you were given",
    ],
    visual: "plan" as const,
  },
  {
    id: "walk",
    kicker: "02  /  Present",
    title: "Walk the backyard before anyone mobilizes.",
    body: "The 3D view is the same model — not a separate artist’s file. Homeowners see water, stone, and night lighting. Your designer stays in control of the geometry.",
    points: [
      "Still captures and orbit clips for the proposal",
      "Finishes that match what you will actually install",
      "A client link you can send after the meeting — or during it",
    ],
    visual: "walk" as const,
    image: {
      src: "/marketing/walkthrough.jpg",
      alt: "Twilight architectural view of a custom pool, spa, and limestone deck",
    },
  },
  {
    id: "close",
    kicker: "03  /  Close",
    title: "Let them choose tile at the table. Keep the drawing.",
    body: "A live finish session puts waterline and patio in front of the homeowner without handing them the CAD file. You host. They decide. The model updates.",
    points: [
      "Share a proposal, not a project file",
      "Swap finishes while you watch",
      "The estimate follows the drawing — not a side spreadsheet",
    ],
    visual: "close" as const,
    image: {
      src: "/marketing/presentation.jpg",
      alt: "Tablet on a dining table showing a pool design beside a printed plan",
    },
  },
] as const;

const WORKFLOW = [
  {
    n: "01",
    title: "Open the job",
    body: "Create the project and bring the survey onto the sheet.",
  },
  {
    n: "02",
    title: "Design in plan",
    body: "Draw the vessel and the hardscape. The same geometry drives 3D and takeoff.",
  },
  {
    n: "03",
    title: "Present and lock finishes",
    body: "Walk the model. Send a client link. Host a live session if the sale needs it.",
  },
  {
    n: "04",
    title: "Price and produce",
    body: "Builder plans export quotes, CSV takeoff, and a draft packet for professional review.",
  },
] as const;

export default async function HomePage() {
  const user = await getSessionUser();
  const appHref =
    user?.role === "platform_owner" ? "/platform" : user ? "/app" : "/signup";

  return (
    <div className="mkt">
      <MarketingHeader user={user} />
      <main>
        <section className="mkt-hero">
          <Image
            src="/marketing/hero-pool.jpg"
            alt="Vanishing-edge pool at dusk with limestone deck and warm house light"
            fill
            priority
            sizes="100vw"
            className="mkt-hero-photo"
          />
          <div className="mkt-hero-veil" />
          <div className="mkt-hero-copy">
            <p className="mkt-kicker mkt-kicker-light">
              For production pool companies
            </p>
            <h1>The drawing that carries the job.</h1>
            <p className="mkt-lede">
              PoolShape is plan, 3D, takeoff, and client presentation — built
              for residential production pool companies. Florida first.
            </p>
            <div className="mkt-hero-actions">
              <Link className="mkt-btn" href={appHref}>
                {user ? "Open workspace" : `Start a ${TRIAL_DURATION_DAYS}-day trial`}
              </Link>
              {!user ? (
                <Link className="mkt-btn mkt-btn-ghost" href="/login">
                  Sign in
                </Link>
              ) : null}
            </div>
            <p className="mkt-hero-note">
              Full Builder features. No credit card. One subscription per
              company.
            </p>
          </div>
        </section>

        <section className="mkt-ribbon" aria-label="Capabilities">
          <ul>
            {CAPABILITIES.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section id="product" className="mkt-section">
          <div className="mkt-section-intro">
            <p className="mkt-kicker">Product</p>
            <h2>Built for the sales cycle and the crew — not a generic drafting tool.</h2>
            <p>
              The model you draw is the model you present and the model you
              price. That is how a production builder keeps the backyard from
              fracturing across Sketch, CAD, and a spreadsheet.
            </p>
          </div>

          {CHAPTERS.map((chapter) => (
            <article
              key={chapter.id}
              className={`mkt-chapter${chapter.visual === "walk" ? " mkt-chapter-reverse" : ""}`}
            >
              <div className="mkt-chapter-copy">
                <p className="mkt-kicker">{chapter.kicker}</p>
                <h3>{chapter.title}</h3>
                <p>{chapter.body}</p>
                <ul className="mkt-points">
                  {chapter.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </div>
              <div className="mkt-chapter-visual">
                {"image" in chapter ? (
                  <Image
                    src={chapter.image.src}
                    alt={chapter.image.alt}
                    width={chapter.visual === "close" ? 1200 : 1600}
                    height={900}
                    sizes="(max-width: 900px) 100vw, 48vw"
                    className="mkt-photo"
                  />
                ) : (
                  <MarketingPlanGraphic />
                )}
              </div>
            </article>
          ))}
        </section>

        <section id="workflow" className="mkt-section mkt-section-dark">
          <div className="mkt-section-intro">
            <p className="mkt-kicker mkt-kicker-light">Workflow</p>
            <h2>From first sketch to a drawing the field can use.</h2>
            <p>
              A {TRIAL_DURATION_DAYS}-day company trial is the full Builder
              product. Subscribe to Sales or Builder when the team is already
              working in it.
            </p>
          </div>
          <ol className="mkt-workflow">
            {WORKFLOW.map((step) => (
              <li key={step.n}>
                <span>{step.n}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="plans" className="mkt-section">
          <div className="mkt-section-intro">
            <p className="mkt-kicker">Plans</p>
            <h2>One subscription. The whole company.</h2>
            <p>
              No credit card required for the free trial. After{" "}
              {TRIAL_DURATION_DAYS} days, choose Sales or Builder.
            </p>
          </div>
          <div className="mkt-plans">
            <article className="mkt-plan">
              <h3>{PLAN_MARKETING.sales.name}</h3>
              <p className="mkt-price">
                {formatMoney(PLAN_PRICING.sales.monthlyCents)}
                <span>/ month</span>
              </p>
              <p className="mkt-plan-blurb">{PLAN_MARKETING.sales.blurb}</p>
              <dl className="mkt-plan-seats">
                {PLAN_SEATS.map((row) => (
                  <div key={row.label}>
                    <dt>{row.label}</dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
              </dl>
              <ul>
                {PLAN_MARKETING.sales.highlights.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <Link className="mkt-btn mkt-btn-quiet" href="/signup">
                Start free trial
              </Link>
            </article>
            <article className="mkt-plan mkt-plan-featured">
              <p className="mkt-plan-tag">Included in the trial</p>
              <h3>{PLAN_MARKETING.builder.name}</h3>
              <p className="mkt-price">
                {formatMoney(PLAN_PRICING.builder.monthlyCents)}
                <span>/ month</span>
              </p>
              <p className="mkt-plan-blurb">{PLAN_MARKETING.builder.blurb}</p>
              <dl className="mkt-plan-seats">
                {PLAN_SEATS.map((row) => (
                  <div key={row.label}>
                    <dt>{row.label}</dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
              </dl>
              <ul>
                {PLAN_MARKETING.builder.highlights.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <Link className="mkt-btn" href="/signup">
                Start free trial
              </Link>
            </article>
          </div>
          <p className="mkt-plans-note">
            The trial is the full Builder product. No credit card. Choose Sales
            or Builder when you subscribe.
          </p>
        </section>

        <section className="mkt-close">
          <p className="mkt-kicker mkt-kicker-light">Get started</p>
          <h2>Put the next backyard on a drawing that can close.</h2>
          <p>
            {TRIAL_DURATION_DAYS} days. Full Builder. No card until you
            subscribe.
          </p>
          <div className="mkt-hero-actions">
            <Link className="mkt-btn" href="/signup">
              Start a company trial
            </Link>
            <Link className="mkt-btn mkt-btn-ghost" href="/login">
              Sign in
            </Link>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
