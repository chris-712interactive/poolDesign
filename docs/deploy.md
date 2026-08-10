# Deploy: Vercel + Postgres

## Why not SQLite on Vercel?

Vercel’s serverless filesystem is ephemeral. This app uses **Postgres** (Neon or Vercel Postgres).

## Local development

```bash
# Start Postgres
docker compose up -d

# Env (from repo root and/or apps/web)
cp .env.example apps/web/.env
cp .env.example packages/db/.env
# Ensure DATABASE_URL points at local Postgres

pnpm install
pnpm db:generate
pnpm db:push
pnpm db:seed
pnpm dev
```

## Vercel project

1. Import the GitHub repo into Vercel.
2. Set **Root Directory** to `apps/web` (required — `next.config` lives there).
3. Enable including files outside the Root Directory so workspace packages resolve.
4. `apps/web/vercel.json` already sets:

```
Install Command: cd ../.. && pnpm install
Build Command:   cd ../.. && pnpm --filter @pool-design/db generate && pnpm --filter @pool-design/web build
```

Do **not** use `pnpm db:generate` in the Vercel UI — that script only exists on the monorepo root package, and with Root Directory `apps/web` pnpm will report `Command "db:generate" not found`.

If the dashboard overrides `vercel.json`, paste the Install/Build commands above into Project Settings → General / Build & Development Settings.

5. Environment variables:

| Name | Value |
|------|--------|
| `DATABASE_URL` | Neon/Vercel Postgres URL (use pooled + `sslmode=require`) |
| `SESSION_SECRET` | Long random string |
| `NEXT_PUBLIC_APP_URL` | `https://your-domain.com` |
| `NEXT_PUBLIC_ROOT_DOMAIN` | `your-domain.com` (no protocol) |
| `BLOB_READ_WRITE_TOKEN` | Optional — Vercel Blob |
| `STRIPE_SECRET_KEY` | Stripe secret |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `STRIPE_PRICE_STARTER_MONTHLY` | Price ID |
| `STRIPE_PRICE_PRO_MONTHLY` | Price ID |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Publishable key |

6. After first deploy, run migrate/push against production DB:

```bash
DATABASE_URL="postgresql://..." pnpm db:push
DATABASE_URL="postgresql://..." pnpm db:seed
```

Then open `https://your-deployment.vercel.app/api/health` — you should see `"ok": true` and `users` &gt; 0. If health fails, login will fail too (usually missing env, wrong URL, schema not pushed, or Prisma engine not traced — see below).

### Prisma query engine on Vercel

This monorepo generates the client into `packages/db/src/generated/client` (includes `libquery_engine-rhel-openssl-3.0.x.so.node`). `apps/web/next.config.ts` traces that folder into the serverless bundle via `outputFileTracingIncludes` + `@prisma/nextjs-monorepo-workaround-plugin`.

If `/api/health` still says the query engine is missing after redeploy, confirm the Production build ran `pnpm --filter @pool-design/db generate` and that Root Directory is `apps/web`.

Or add a one-off Vercel cron / GitHub Action.

## Wildcard subdomains

1. Add `your-domain.com` and `*.your-domain.com` in Vercel Domains.
2. Set `NEXT_PUBLIC_ROOT_DOMAIN=your-domain.com`.
3. Company slug `acme-pools` resolves as `acme-pools.your-domain.com` via [apps/web/src/lib/tenant.ts](../apps/web/src/lib/tenant.ts).

## Stripe webhooks

Point Stripe to `https://your-domain.com/api/stripe/webhook` for:

- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Company admins start Checkout / open the Customer Portal from `/app/admin`.

## Client proposals (Phase 1)

- Designer: **Share with client** in CAD → creates `ProjectShare` + optional Blob/data-URL PNG
- Public page: `/p/[token]` (no login)
- APIs: `/api/projects/[id]/shares`, `/api/public/shares/[token]`

## Team invites (Phase 3)

- Company admin invites from `/app/admin`
- Invitee accepts at `/invite/[token]` with the temporary password
