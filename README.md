# Pool Design

Multi-tenant pool CAD and estimating SaaS for pool companies — residential, commercial, and water-park design levels, offline-capable field design, company admin, platform owner console, and homeowner client portal.

## Stack

- **apps/web** — Next.js (App Router) web app + API
- **packages/shared** — design model, units, roles, milestones
- **packages/db** — Prisma schema and seed data

## Quick start

```bash
pnpm install
cp .env.example apps/web/.env
cp .env.example packages/db/.env
pnpm db:generate
pnpm db:push
pnpm db:seed
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) (or the port shown in the terminal if 3000 is busy).

### What’s in this first build

- Multi-tenant data model (companies, roles, projects, onboarding milestones)
- Platform owner console with milestone complete/dismiss
- Company projects with **residential / commercial / water park** levels
- Designer **imperial / metric** setting
- CAD workspace: pool rectangle/polygon, patio regions, plumbing runs, ortho + unit snap (`1/32"` / `1 mm`), edge dimensions, shallow/deep depths, layers, undo/redo, save to project
- **Estimate / BOM**: automatic takeoffs (finish, coping, patio, pipe LF, equipment, labor) with starter catalog pricing
- **Object library**: place furniture/amenities (lounge chairs, tables, umbrellas, fire pits, etc.) filtered by design level; counts roll into the BOM

### Seed logins

| Role | Email | Password |
|------|-------|----------|
| Platform owner | owner@pooldesign.app | password123 |
| Company admin | admin@acme-pools.test | password123 |
| Designer | designer@acme-pools.test | password123 |

## Monorepo scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start web app |
| `pnpm db:push` | Push Prisma schema |
| `pnpm db:seed` | Seed demo company + milestones |
| `pnpm build` | Build all packages |
