# Launch readiness — what is still in the way

PoolShape already has the sales-cycle loop: company trial, CAD + 3D, share links, live finish sessions, takeoff, print quote, draft permit packet, Stripe Sales/Builder. That is enough to **show** a production builder. It is not yet enough to **run** one as a paying customer without you in the room.

This is the ordered list of what still has to happen to get off the ground. Product polish (water, plants, coping) can continue in parallel; it is not the launch gate.

---

## 1. Take money and keep the lights on (do first)

These block a real company from signing up, paying, and recovering access.

| Gap | Why it blocks launch | Where it lives |
| --- | --- | --- |
| **No transactional email** | Invites show a temp password in the admin UI. There is no forgot-password mail, trial-ending mail, or “you subscribed” receipt besides Stripe. A designer who loses the copied password is locked out. | `lib/invites.ts`, no mailer |
| **No password reset** | Login has no recovery path. Admins can change their own password only while signed in. | `/login`, `/api/account/password` |
| **Stripe live mode not wired as a checklist** | Checkout, portal, seat add-ons, and webhooks exist, but production still needs live Price IDs, webhook endpoint, and a failed-payment path you have actually tested. | `docs/deploy.md`, `api/stripe/*` |
| **Vercel Blob required for stills** | Proposal PNGs must not live in Postgres. A production deploy without `BLOB_READ_WRITE_TOKEN` silently degrades (data URLs / missing stills). | `.env.example`, share APIs |
| **Custom session auth** | HMAC cookie, 14-day max age, no logout-everywhere, no rotation, production fallback used to be a hardcoded secret. Fine for a trial; not a long-term identity system. | `lib/auth.ts` |
| **No rate limits** | Signup, login, and invite-accept are unthrottled. The honeypot on signup is the only bot check. | `/signup`, `/login` |
| **Health check used to leak internals** | `/api/health` is public. Counts and raw DB errors should stay off production responses. | `api/health/route.ts` |
| **`pnpm db:seed` is a production foot-gun** | Seed used to upsert demo users and **reset their passwords to `password123`**. Deploy docs told you to seed production. | `packages/db/prisma/seed.ts` |
| **No CI** | Shared package has unit tests; the web app has none. Nothing ran on push. | `package.json` `test` script |
| **Legal copy is a stub** | Terms/privacy are a few paragraphs, last updated Aug 14 2026, with no operator address, no DPA, no real support contact until `SUPPORT_EMAIL` is set. Counsel should review before you take cards. | `/terms`, `/privacy` |
| **No error monitoring** | Failures go to `console.error`. You will not see a broken webhook or a Prisma engine miss on Vercel until a customer reports it. | — |

**Exit criteria:** A stranger can start a trial, invite a designer **by email**, recover a password, subscribe on Stripe live, and you get an alert if `/api/health` or the webhook fails.

---

## 2. First-customer product (residential FL builder)

Do not wait for commercial/water-park depth. Win one residential shop.

| Gap | Why it matters | Notes |
| --- | --- | --- |
| **Starter catalog, not their book** | Takeoffs use a generic residential price list. Overrides exist, but there is no CSV import of a real builder book. First quote will be wrong until they reprice everything. | `packages/shared/src/catalog.ts`, `/app/admin` price book |
| **Quote is print-HTML, not a file** | “PDF quote” is “open HTML → Print → Save as PDF.” Works, but salespeople expect a download. | `api/projects/[id]/quote` |
| **Live session is DB polling** | Kitchen-table finish swaps work without WebSockets. Latency and “is the host online?” will feel cheap on a bad connection. Acceptable for v1 if you set expectations. | `ProjectLiveSession`, `/api/p/[token]/live` |
| **Grade walk is typed distances, not AR** | The import API and panel exist. The phone ARKit companion does not. Do not market “AR grade walk” until the companion ships. | `GradeWalkPanel`, roadmap Phase 3 |
| **Landscaping is Florida-specific** | Plant library is a FL production palette. Fine if the first market is Florida; misleading on a national landing page. | `florida-plants.ts` |
| **Commercial / water-park are labels** | Design levels exist; the catalog comment says commercial/water park expand later. Do not sell those levels as first-class until the book and objects match. | `catalog.ts`, `object-library.ts` |
| **Field / iPad CAD** | Phase 5 is deferred. Designers on a tablet in the backyard will struggle. First customers should design at a desk. | `docs/product-roadmap.md` Phase 5 |
| **Desktop offline is a noop** | `apps/desktop` prints “later milestone.” Do not promise field-without-Wi‑Fi. | `apps/desktop/package.json` |
| **Owner-console milestones overclaim** | Catalog includes “contract signed,” “payment recorded,” and “offline sync” — none of which the app does. | `DEFAULT_ONBOARDING_MILESTONES` |
| **CAD visual debt is ongoing** | Recent history is water, coping, plants, spa, deck. That work should continue, but a **canned residential demo job** (not an empty design) is more important for sales than the next shader. | git log, seed project `Kendig Residence Pool` |

**Exit criteria:** One FL production builder completes a real backyard in CAD, sends a share link, hosts a live finish swap, downloads a quote they would actually show a homeowner, and does not need you on Zoom to invite their designer.

---

## 3. Positioning and ops (same week as first trial)

| Gap | Action |
| --- | --- |
| **Support channel** | Set `SUPPORT_EMAIL`. Put it on terms, privacy, footer, and the forgot-password page. A mailbox you actually read. |
| **Domain + wildcard** | `NEXT_PUBLIC_ROOT_DOMAIN` + `*.your-domain.com` or drop subdomain tenancy until you need it. Signup works on the apex today. |
| **Do not seed production demos** | Milestones yes; Acme Pools / `password123` no. Use `SEED_DEMO=1` only on staging. |
| **Marketing vs product** | Landing page says “photoreal 3D” and “AR grade-walk import” on Builder. 3D is WebGL procedural; AR is a web form. Tighten copy for the first ten customers. |
| **Feature flags** | Roadmap Phase 0 still lists flags. You do not have them. Ship one `SHOW_DEMO_LOGIN` / `ENABLE_WATER_PARK` if you need to hide unfinished levels. |
| **Credit packs** | Roadmap optional. Skip until a Sales customer hits HQ export limits. |

---

## 4. Explicitly later (do not block launch)

- Native ARKit/ARCore companion
- Electron offline shell
- Full CRDT multiplayer CAD
- WebGPU rewrite
- Pay-per-export credits
- Homeowner marketplace (out of scope)
- PE-stamped packets (out of scope)

---

## Suggested sequence

```text
This week
  Stripe live + Blob + SESSION_SECRET + SUPPORT_EMAIL
  Transactional email (invites + password reset + trial ending)
  Rate-limit login/signup
  Sentry (or equivalent) on the web app
  One complete residential demo project for sales calls

Next
  CSV price-book import
  Real PDF download (or a better print stylesheet + company letterhead)
  Hide commercial/water-park (or label as preview)
  Counsel pass on terms/privacy

Then sell
  Sit with one FL builder for a live job
  Only then: AR companion, iPad CAD, desktop offline
```

The CAD rendering work can keep going the whole time. It is not what is keeping this from getting off the ground.
