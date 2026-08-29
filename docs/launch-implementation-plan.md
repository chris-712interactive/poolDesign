# Launch implementation plan

How to close the gaps in [launch-readiness.md](launch-readiness.md). Work is sliced so each piece is a PR (or an ops checklist). Do not start parked items until Slice 8 has a real builder on a live job.

CAD visual polish (water, plants, coping) is **out of this plan**. Keep it on `main` in parallel.

---

## Rules

1. **One slice per PR.** Merge before starting the next unless two slices truly do not touch.
2. **Ops before invention.** Stripe live, Blob, and `SUPPORT_EMAIL` are configuration. Do not rewrite auth to get a first customer.
3. **Florida residential only.** Hide or label commercial / water-park. Do not expand the catalog.
4. **Mailer is the spine.** Invites, password reset, and trial-ending mail all need `lib/mail.ts`. Build that first among code slices.
5. **No new SaaS until it is forced.** Rate limits: Postgres table, not Redis, unless traffic requires it. PDF: print stylesheet, not a headless-Chrome farm.

---

## Already done (this PR)

- Seed no longer resets `password123` in production
- `SESSION_SECRET` required in production
- `/api/health` does not leak counts/errors in production
- GitHub Actions CI (typecheck + shared tests)
- `SUPPORT_EMAIL` on footer / terms / privacy
- Honest `/forgot-password` stub (no mail yet)

---

## Slice 1 — Production config (ops, no feature code)

**Owner:** whoever can log into Vercel, Stripe, and DNS.

Checklist (tick in deploy notes when done):

- [ ] `SESSION_SECRET` — long random, Vercel Production + Preview
- [ ] `SUPPORT_EMAIL` — a mailbox that is read
- [ ] `DATABASE_URL` — Neon pooled + `sslmode=require`; `pnpm db:push` once; `pnpm db:seed` **without** `SEED_DEMO`
- [ ] `BLOB_READ_WRITE_TOKEN` — Vercel Blob store; confirm a 3D still and a survey upload land on a blob URL, not a data URL
- [ ] Stripe **live**: products Sales (`starter`) and Builder (`pro`), extra designer seat price, Customer Portal
- [ ] Env: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_STARTER_MONTHLY`, `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_DESIGNER_SEAT_MONTHLY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- [ ] Webhook `https://<domain>/api/stripe/webhook` for `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
- [ ] Manual test: trial company → Checkout Sales → webhook sets `planKey=starter`, `subscriptionStatus=active` → Portal cancel → CAD blocks with billing message
- [ ] Manual test: failed card / `past_due` (Stripe test clock on a staging clone first)
- [ ] `NEXT_PUBLIC_APP_URL` + `NEXT_PUBLIC_ROOT_DOMAIN`; skip `*.domain` until a customer asks for a subdomain
- [ ] Platform owner password is **not** `password123`

**Done when:** a throwaway company can subscribe and cancel on live Stripe; stills persist after deploy.

---

## Slice 2 — Mailer + invite email

**Why first among code:** every other access path (invite, reset, trial nag) hangs off this.

### Approach

Use [Resend](https://resend.com) (Vercel-friendly). One module, HTML + text for each template. If `RESEND_API_KEY` is missing, keep today’s “copy this password” UI so local Docker still works.

### Schema / env

- Env: `RESEND_API_KEY`, `MAIL_FROM` (e.g. `PoolShape <noreply@your-domain.com>`), domain verified in Resend
- No new table

### Code

| Piece | Where |
| --- | --- |
| `sendMail({ to, subject, html, text })` | new `apps/web/src/lib/mail.ts` |
| Invite template (link + temp password + expiry) | `apps/web/src/lib/mail-templates.ts` |
| Send after `createCompanyInvite` | `apps/web/src/lib/invites.ts` |
| Admin UI: “Email sent to …” and only show the password if mail was skipped | `CompanyAdminClient.tsx`, `SetupWizardClient.tsx` |
| Signup welcome (optional same slice) | `lib/signup.ts` after company create |

### Tests

- Template renders contain token URL and do not leak other companies
- `sendMail` no-ops with a clear result when unset (unit test with a fake)

**Done when:** inviting `designer@…` delivers mail; clicking `/invite/[token]` + temp password creates the user; admin UI does not *require* copying the password if mail succeeded.

---

## Slice 3 — Password reset

**Depends on:** Slice 2.

### Schema

```prisma
model PasswordResetToken {
  id        String   @id @default(cuid())
  userId    String
  tokenHash String   @unique
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime @default(now())
  user      User     @relation(...)
}
```

Store **hash** of the token, not the token. TTL 1 hour. One unused token per user (delete previous on new request).

### Routes

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/forgot-password` | Replace stub with email form |
| POST | `/api/auth/forgot` | Always 200 (“if that email exists…”). If user exists, mail reset link |
| GET | `/reset/[token]` | Form: new password + confirm |
| POST | `/api/auth/reset` | Validate token, bcrypt new password, mark used, `setSessionCookie` |

Reuse `MIN_PASSWORD = 8` from `api/account/password`. After reset, bump a `User.sessionEpoch` (add `Int @default(0)`, include epoch in the HMAC payload in `lib/auth.ts`) so old cookies die. That is the cheap “logout everywhere” you need at launch; do not migrate to Better Auth in this slice.

### Tests

- Unknown email still 200
- Used / expired token 400
- Session cookie from before reset is rejected

**Done when:** a locked-out admin gets mail, sets a new password, old session cannot hit `/app`.

---

## Slice 4 — Rate limits

**Depends on:** Slice 3 (limit forgot-password or it is an enumeration cannon). Can land in the same PR as Slice 3 if small.

### Approach

Postgres, not Redis. Serverless memory will not stick on Vercel.

```prisma
model AuthThrottle {
  id        String   @id @default(cuid())
  key       String   // "login:ip" | "login:email" | "forgot:email" | "signup:ip"
  windowStart DateTime
  count     Int
  @@unique([key, windowStart])
}
```

Helper `assertNotThrottled({ key, limit, windowSec })` in `apps/web/src/lib/throttle.ts`. Fail closed with 429.

Limits (starting point):

- Login: 10 / 15 min / IP and 8 / 15 min / email
- Signup: 5 / hour / IP
- Forgot: 5 / hour / email
- Invite accept: 10 / hour / IP

Apply in `login/page.tsx` (server action), `signup.ts`, forgot/reset routes, invite accept.

**Done when:** bursting login from one IP returns 429; a legitimate user still signs in.

---

## Slice 5 — Error monitoring

**Depends on:** nothing. Can parallel Slice 2.

### Approach

`@sentry/nextjs` on `apps/web`. `SENTRY_DSN` env. Do not send PII in CAD payloads (design JSON is large and may include client names — strip or sample).

Also:

- Vercel: alert if `/api/health` is non-200
- Stripe: Dashboard email on failed webhooks (ops)

**Done when:** a thrown route handler appears in Sentry; health is watched.

---

## Slice 6 — First-customer product (price book CSV)

**Depends on:** nothing. Highest leverage for a real quote.

### Approach

Do not invent a second catalog. Import **overrides** against existing `catalogItemId` (and match by name as fallback).

| Piece | Where |
| --- | --- |
| `priceBookToCsv` / `parsePriceBookCsv` | `packages/shared/src/price-book-csv.ts` + tests |
| `GET /api/company/price-book?format=csv` | existing `price-book/route.ts` |
| `PUT` with `text/csv` or `{ csv: string }` | same route; reuse upsert loop |
| Admin: Export CSV / Import CSV | `CompanyAdminClient.tsx` prices section |

CSV columns: `catalogItemId,name,unit,unitPriceUSD,overridden`.

Unknown IDs: skip + return `{ skipped: [...] }`. Never create free-form SKUs in v1 (that forks takeoff). If a builder’s book has items we do not take off, they stay on the estimate recipe as custom lines later — out of this slice.

**Done when:** export → change two prices in Sheets → import → estimate uses the new cents.

---

## Slice 7 — Quote as a file the salesperson expects

**Depends on:** Slice 6 is nice-to-have first so numbers are theirs.

Keep HTML. Do not stand up Puppeteer.

1. Add a visible **Print / Save as PDF** control in the quote HTML (`class="no-print"` bar already contemplated in `quote-docs.ts`)
2. Estimate panel: open quote in a new tab (already) and copy that says “Print → Save as PDF”
3. `@page { margin: 0.6in; size: letter; }` plus company logo (already in `buildQuoteHtml`)
4. Optional same slice: `Content-Disposition: attachment` with `.html` is wrong for print — leave `inline`

If a customer still refuses print-to-PDF, a follow-on can use a paid HTML→PDF API. Not launch-blocking.

**Done when:** a Builder admin produces a letter-sized PDF from a real project in under 30 seconds without asking you.

---

## Slice 8 — Demo job + copy honesty

**Depends on:** nothing. Do in parallel with 6/7.

### Demo project

Seed `Kendig Residence Pool` with a **complete** residential `DesignDocument` (pool, spa, patio, fence, equipment pad, a few plants, finishes). Store as `packages/db/prisma/fixtures/kendig-residential.json` and load only when `SEED_DEMO=1`. Empty `emptyDesignDocument(...)` is useless on a sales call.

### Copy / flags

- Env `NEXT_PUBLIC_ENABLE_WATER_PARK=0` (default off), same for commercial if needed — `CreateProjectForm` hides levels
- Landing + Builder bullets: drop “AR grade-walk” and “photoreal” until true. “3D walkthrough” and “phone grade import” are accurate
- Owner console: stop showing `first_contract_signed`, `first_payment_recorded`, `offline_sync` as if the app did them — either remove from `DEFAULT_ONBOARDING_MILESTONES` or mark `source: "manual"` only for the platform owner

**Done when:** sales call opens Kendig and it looks like a job; marketing does not claim AR or PE stamps.

---

## Slice 9 — Legal (counsel, light code)

Not a feature PR.

- Operator name, address, governing law on `/terms` and `/privacy`
- Client share-link warning stays (already there)
- DPA only if a builder asks (B2B, US-first)

**Done when:** counsel has signed off or you accept the stub risk in writing.

---

## Parked (do not schedule)

| Item | When it becomes worth it |
| --- | --- |
| Neon Auth / Better Auth replacement | You need SSO or are tired of HMAC cookies after 10 companies |
| Native ARKit companion | A builder is walking grade with a phone and the web form is the complaint |
| Electron offline | Jobs exist with no cell service *and* they will pay for it |
| WebSocket live session | Kitchen-table polling is visibly laggy on a real close |
| True PDF service | Print-to-PDF is rejected by a paying Builder |
| CSV → custom SKUs / commercial catalog | Second market, not first |
| Credit packs | Sales tier hits HQ export limits |
| WebGPU, CRDT CAD | Never for launch |

---

## Suggested PR order

```text
Slice 1  ops checklist (no PR, or a docs-only tick list)
Slice 2  mailer + invite email
Slice 3  password reset + sessionEpoch   ⎤ can be one PR
Slice 4  Postgres rate limits            ⎦
Slice 5  Sentry                          — parallel with 2–4
Slice 6  price-book CSV
Slice 7  quote print polish
Slice 8  Kendig fixture + marketing flags
Slice 9  counsel pass
         sit with one FL builder
```

## Definition of “off the ground”

A stranger can:

1. Start a 14-day trial
2. Invite a designer who receives email
3. Reset a forgotten password
4. Pay Sales or Builder on live Stripe
5. Import their unit prices
6. Send a client share and host a live finish swap
7. Print a quote they would put on a table

You see it if health or a webhook breaks. You are not on Zoom to copy a temp password.

That is the launch. Everything else is product after revenue.
