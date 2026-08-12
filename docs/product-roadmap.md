# PoolShape product roadmap

Filtered competitive plan: ship sales-cycle speed and construction-doc value without overclaiming AI or engineering stamps, and without undercutting the B2B company model.

**In scope (agreed)**
1. PDF quote + Sales vs Builder entitlements (monetize existing takeoffs)
2. Live client sessions (limited guest edits)
3. AR grade walk + light site-capture assist
4. Draft permit packet (non-stamped)
5. Field / WebGL performance (ongoing)

**Out of scope / parked**
- “Instant engineered” permit stamps
- Pure free CAD + pay-per-export only
- Public free homeowner → sell leads to builders (conflicts with B2B customers)
- WebGPU rewrite unless profiling proves WebGL is the bottleneck
- Full Figma-grade multiplayer on every CAD tool (v1 is host-driven)

---

## Implementation status (in progress)

| Phase | Status |
|-------|--------|
| 0 Foundations / entitlements | **Done** — `entitlements.ts`, designRevision, Sales/Builder labeling |
| 1 PDF quote + CSV + gating | **Done** — Estimate panel exports; Stripe Sales/Builder CTAs |
| 2 Live client sessions | **Done (v1)** — DB-polled host/guest finish swaps + approvals |
| 3 AR grade walk | **Done (web import)** — Grade walk panel + `/grade-walk` API; native ARKit companion later |
| 4 Draft permit packet | **Done** — multi-sheet HTML draft with disclaimer |
| 5 Field performance | Deferred / ongoing |

---

## Current footholds

| Capability | Status | Key code |
|------------|--------|----------|
| Browser 3D (WebGL / R3F) | Shipped | `apps/web/src/components/CadScene3DCanvas.tsx`, `lib/cad3d/` |
| Excavation / material takeoffs | Shipped | `packages/shared/src/takeoff.ts`, `site-grade.ts` |
| Grade samples (manual) | Shipped | `DesignDocument.gradeSamples` (`dropMm` vs FFE) |
| Client proposal share | Shipped (read-only) | `/p/[token]`, `ProjectShare` |
| Company Stripe plans | Shipped (`starter` / `pro`) | `Company.planKey`, Stripe Checkout |
| AI photo-to-3D | None | — |
| Realtime collab | None | — |
| PDF quote / plan packet | None | — |
| AR site / grade capture | None | — |

---

## Pricing shape

Keep **company subscription** as the core. Use usage credits as add-ons, not the only model.

| Tier | Maps from | Includes |
|------|-----------|----------|
| **Sales** (~$29–49/mo target) | `starter` | CAD + 3D, finishes, share links, live client session, limited HQ exports |
| **Builder** (~$99/mo target) | `pro` | Everything in Sales + full takeoffs/price book depth, PDF quote, draft permit packet, AR grade import |
| **Credits** | metered | Extra HQ renders, plan PDFs, or seats |

Entitlements live on `Company.planKey` (+ optional credit balance). Soft-gate in UI; hard-gate on export/API routes.

---

## Phase 0 — Foundations (1–2 weeks)

Unblocks billing gates, exports, and later collab.

- [ ] Entitlement matrix in shared package (`canExportPdfQuote`, `canLiveSession`, `canArGradeCapture`, …)
- [ ] Feature flags for phased rollout
- [ ] Design save conflict strategy (last-write + revision / etag) for collab prep
- [ ] Legal/disclaimer copy for any “plan” export: draft for PE/drafting review, not stamped
- [ ] Choose PDF approach (server-side HTML→PDF or print stylesheet)

**Primary touchpoints:** `packages/shared`, `packages/db/prisma/schema.prisma`, `apps/web/src/lib/subscription.ts`

---

## Phase 1 — Monetize existing takeoffs (2–4 weeks) — ship first

Highest leverage: takeoffs and branding already exist.

### 1.1 Itemized PDF quote
- Render company logo, project meta, line items from `buildTakeoff()`, totals, units
- Optional notes / exclusions
- Download from Estimate panel + optional attach to share flow

### 1.2 Estimator export
- CSV (and optionally XLS) of takeoff lines for external spreadsheets

### 1.3 Sales vs Builder gating
- Remap Stripe price IDs / `planKey` semantics to Sales / Builder
- Gate: PDF quote, deep price book, unlimited HQ PNG/WebM → Builder (or credits)
- Sales keeps design, 3D, proposal stills, live session (Phase 2)

### 1.4 Pay-per-export credits (optional same phase or follow-on)
- Credit pack via Stripe for HQ render / PDF beyond plan limits

**Primary touchpoints:** `EstimatePanel.tsx`, `takeoff.ts`, `BillingActions.tsx`, `apps/web/src/app/api/stripe/`

**Exit criteria:** Paying Builder company can download a branded PDF quote from a real project in &lt;30s.

---

## Phase 2 — Live client sessions (4–8 weeks) — primary sales differentiator

Move `/p/[token]` from static snapshot toward kitchen-table closing.

### 2.1 Presence room
- WebSocket / Liveblocks / PartyKit room keyed by project (or share token)
- Host = designer/salesperson (full CAD)
- Guest = client viewer on phone/tablet

### 2.2 Limited guest actions (v1)
- Swap finishes (waterline tile, patio, etc.)
- Approve / reject options with timestamped audit trail
- Optional: constrained pool size nudge (not freeform vertex editing)

### 2.3 Share link upgrade
- “Join live session” on proposal page when host is online
- Fallback remains current read-only still + estimate

**Defer:** Full CRDT multiplayer editing of every CAD tool.

**Primary touchpoints:** `CadWorkspace.tsx`, `app/p/[token]/page.tsx`, share APIs, new realtime service

**Exit criteria:** Salesperson and client co-view a project; client swaps a finish and host sees it; approval recorded.

---

## Phase 3 — Site capture: AR grade walk + light assist (6–12 weeks)

Two related tracks. **AR grade walk is the accuracy-critical path**; photo assist is optional scaffolding.

### 3.1 AR grade walk (priority within this phase)

**User flow**
1. Designer stands at back of house → taps **Start grade walk** (anchor = FFE / slab reference)
2. Walks a straight (or multi-leg) transect outward
3. Phone samples pose every N feet (or on demand taps)
4. Each sample: plan offset from anchor + `dropMm` (relative elevation vs start)
5. Preview profile chart → **Import into design** as `GradeSample[]`
6. Existing `site-grade` fill / retaining analysis runs unchanged

**Technical notes**
- Prefer **ARKit / ARCore** visual-inertial tracking (not GPS altitude)
- LiDAR devices preferred; non-LiDAR allowed with drift warnings
- Capture UX: distance walked, live drop, tracking-quality banner, “hold steady / more light” coaching
- Delivery options: lightweight native shell / PWA+WebXR where capable, or Capacitor/Expo companion that posts samples into the web project API
- Store source metadata on samples later if needed (`source: "ar_walk"`, confidence)

**Accuracy framing (product copy)**
- For sales / estimating assist
- Not a substitute for survey or construction staking
- Designer can edit/delete imported grade points in CAD

**Primary touchpoints:** new capture client; import API; `GradeSample` in `design-model.ts`; `site-grade.ts`; CAD grade tools in `CadWorkspace.tsx`

### 3.2 Light photo / site assist (secondary)
- Upload 2–3 backyard photos → draft house/fence overlays or skybox reference
- Human confirm before geometry affects takeoffs
- Do **not** market as instant build-ready 3D

**Exit criteria:** Walk from house → import ≥3 grade samples → patio fill/retaining numbers update; designer can adjust points manually.

---

## Phase 4 — Draft permit packet (6–10 weeks, after PDF quote)

“Generate plan package” — clearly labeled draft for professional review.

### Contents (v1)
- Plan view: pool, patio, house, fence, equipment pad; setbacks if user-entered property lines
- Cross-section from depth stations / existing depth profile data
- Barrier checklist sheet (`barrier-checks.ts`)
- Equipment / hydraulics notes (advisory)

### Explicitly not included
- PE stamp, sealed calcs, invented property lines/utilities from photos

**Primary touchpoints:** new plan-layout module, PDF pipeline from Phase 1, hydraulics/barrier shared packages

**Exit criteria:** One click produces multi-page PDF draft from a complete residential design.

---

## Phase 5 — Field performance (ongoing, parallel)

- iPad / touch CAD chrome and reduced shader cost
- Texture / LOD budgets for Chromebook-class devices
- Profile before any WebGPU work
- Electron offline remains a later milestone (`apps/desktop` scaffold)

---

## Suggested sequence

```text
Phase 0  Foundations / entitlements
   ↓
Phase 1  PDF quote + Sales/Builder  ← revenue proof
   ↓
Phase 2  Live client session         ← close-rate wedge
   ↓
Phase 3  AR grade walk (+ light photo assist)
   ↓
Phase 4  Draft permit packet         ← Builder upsell
   ║
Phase 5  Perf / field UX (parallel)
```

---

## Success metrics (lightweight)

| Phase | Signal |
|-------|--------|
| 1 | % of Builder projects with ≥1 PDF quote download |
| 2 | Live sessions per active company / week; finish swaps → won deals (qualitative) |
| 3 | Designs with AR-imported `gradeSamples`; edit rate after import (too high = UX/accuracy issue) |
| 4 | Permit packet downloads on Builder; support tickets claiming “stamp ready” (should stay ~0) |

---

## Explicit non-goals (reaffirm)

1. Claiming phone grade walks or plan PDFs are survey- or PE-grade
2. Homeowner marketplace / lead resale
3. Replacing the takeoff engine (extend + export it)
4. Rewriting the 3D stack for marketing parity with “WebGPU”
