# PoolShape

Multi-tenant pool CAD and estimating SaaS for pool companies — residential, commercial, and water-park design levels, offline-capable field design, company admin, platform owner console, and homeowner client portal.

## Stack

- **apps/web** — Next.js (App Router) web app + API
- **packages/shared** — design model, units, roles, milestones
- **packages/db** — Prisma schema and seed data

## Quick start

```bash
pnpm install
docker compose up -d
cp .env.example apps/web/.env
cp .env.example packages/db/.env
pnpm db:generate
pnpm db:push
pnpm db:seed
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) (or the port shown in the terminal if 3000 is busy).

**Database:** Postgres is required (local Docker via `docker compose`, or Neon / Vercel Postgres in production). See [docs/deploy.md](docs/deploy.md).

### What’s in this first build

- Multi-tenant data model (companies, roles, projects, onboarding milestones)
- Platform owner console with milestone complete/dismiss
- Company projects with **residential / commercial / water park** levels
- Designer **imperial / metric** setting
- CAD workspace (design-platform focus): pool/patio/steps/bench/plumbing/library, zoom/pan, vertex edit + move, rotate furniture, measure tool, typed length entry, ortho + 15° snap, design checklist, layers, undo/redo
- **3D preview** with PNG / orbit clip export
- **Client share links** (`/p/[token]`) — read-only proposal with still + estimate; optional **live finish session**
- **Estimate / BOM**: automatic takeoffs with starter catalog pricing + company price overrides
- **Builder exports**: printable PDF quote, CSV takeoff, draft permit packet (gated by plan)
- **Grade walk import**: transect distance + drop → grade samples (phone AR API-ready)
- **Stripe** Sales (`starter`) / Builder (`pro`) after a **local 14-day trial** (no card, no Stripe trial)
- **Team invites** from company admin
- **Object library**: furniture/amenities filtered by design level; counts roll into the BOM
- **Deploy:** Vercel + Postgres — [docs/deploy.md](docs/deploy.md)
- **Roadmap:** [docs/product-roadmap.md](docs/product-roadmap.md)

### Seed logins

| Role | Email | Password |
|------|-------|----------|
| Platform owner | owner@poolshape.com | password123 |
| Company admin | admin@acme-pools.test | password123 |
| Designer | designer@acme-pools.test | password123 |

## Monorepo scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start web app |
| `pnpm db:push` | Push Prisma schema |
| `pnpm db:seed` | Seed demo company + milestones |
| `pnpm build` | Build all packages |
