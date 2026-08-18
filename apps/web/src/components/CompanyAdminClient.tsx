"use client";

import { useEffect, useState, type FormEvent, Fragment } from "react";
import { useRouter } from "next/navigation";
import { formatMoney, COMPANY_STAFF_ROLES, STAFF_ROLE_LABELS, DESIGNER_SEAT_MONTHLY_CENTS, type CompanyStaffRole, type EstimateRecipe, type MarketStateRow } from "@pool-design/shared";
import { AddressFields } from "@/components/AddressFields";
import { BillingActions } from "@/components/BillingActions";
import { EstimateRecipeEditor } from "@/components/EstimateRecipeEditor";
import { type AdminSection } from "@/lib/adminSections";
import { TOUR_QUERY, TOUR_STEP_QUERY } from "@/lib/onboardingTour";

type Profile = {
  name: string;
  logoUrl: string | null;
  region: string | null;
  defaultUnitSystem: "imperial" | "metric";
  slug: string;
  street: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
};

type PriceItem = {
  id: string;
  name: string;
  category: string;
  unit: string;
  defaultUnitPriceCents: number;
  unitPriceCents: number;
  overridden: boolean;
};

type InviteResult = {
  temporaryPassword: string;
  inviteUrl: string;
  email: string;
} | null;

const NAV: { id: AdminSection; label: string; hint: string }[] = [
  {
    id: "company",
    label: "Company",
    hint: "Name, address, service area, and units",
  },
  {
    id: "team",
    label: "Team",
    hint: "Permissions, seats, and invites",
  },
  {
    id: "markets",
    label: "Markets",
    hint: "Where jobs are coming from",
  },
  {
    id: "prices",
    label: "Price book",
    hint: "Catalog prices for estimates",
  },
  {
    id: "recipe",
    label: "Estimate recipe",
    hint: "What to bill from the plan",
  },
  {
    id: "billing",
    label: "Billing",
    hint: "Trial, Sales, and Builder plans",
  },
];

type Member = {
  id: string;
  name: string;
  email: string;
  isSelf: boolean;
  roles: CompanyStaffRole[];
  designerLicensed: boolean;
};

type SeatPrompt = {
  userId: string;
  roles: CompanyStaffRole[];
  warning: string;
  monthlyCents: number;
};

type Props = {
  initialProfile: Profile;
  billing: {
    planKey: string;
    status: string;
    hasCustomer: boolean;
    stripeCustomerId: string | null;
    trialEndsAt: string | null;
    extraDesignerSeats: number;
  };
  canEditRecipe?: boolean;
  rootDomain: string;
  initialSection?: AdminSection;
  seatFlash?: "success" | "canceled" | null;
};

export function CompanyAdminClient({
  initialProfile,
  billing,
  canEditRecipe = false,
  rootDomain,
  initialSection = "company",
  seatFlash = null,
}: Props) {
  const router = useRouter();
  const [section, setSection] = useState<AdminSection>(initialSection);
  const [profile, setProfile] = useState(initialProfile);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("designer");
  const [inviteResult, setInviteResult] = useState<InviteResult>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [items, setItems] = useState<PriceItem[]>([]);
  const [priceMsg, setPriceMsg] = useState<string | null>(null);
  const [pricesLoaded, setPricesLoaded] = useState(false);
  const [recipe, setRecipe] = useState<EstimateRecipe | null>(null);
  const [recipeDefault, setRecipeDefault] = useState(true);
  const [recipeLoaded, setRecipeLoaded] = useState(false);
  const [recipeMsg, setRecipeMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoaded, setMembersLoaded] = useState(false);
  const [teamMsg, setTeamMsg] = useState<string | null>(
    seatFlash === "success"
      ? "Designer license is active and assigned."
      : seatFlash === "canceled"
        ? "License checkout was canceled."
        : null,
  );
  const [seatPrompt, setSeatPrompt] = useState<SeatPrompt | null>(null);
  const [seatBusy, setSeatBusy] = useState(false);
  const [designerCapacity, setDesignerCapacity] = useState(1);
  const [paidDesignerSeats, setPaidDesignerSeats] = useState(0);
  const [markets, setMarkets] = useState<{
    total: number;
    unlabeled: number;
    byState: MarketStateRow[];
  } | null>(null);
  const [marketsLoaded, setMarketsLoaded] = useState(false);
  const [extraDesignerSeats, setExtraDesignerSeats] = useState(
    billing.extraDesignerSeats,
  );
  const [trialActive, setTrialActive] = useState(
    billing.status === "trialing",
  );

  useEffect(() => {
    setSection(initialSection);
  }, [initialSection]);

  function goTo(next: AdminSection) {
    setSection(next);
    const params = new URLSearchParams();
    params.set("section", next);
    if (typeof window !== "undefined") {
      const cur = new URLSearchParams(window.location.search);
      const tour = cur.get(TOUR_QUERY);
      const step = cur.get(TOUR_STEP_QUERY);
      if (tour) params.set(TOUR_QUERY, tour);
      if (step) params.set(TOUR_STEP_QUERY, step);
    }
    router.replace(`/app/admin?${params.toString()}`, { scroll: false });
  }

  useEffect(() => {
    if (section !== "prices" || pricesLoaded) return;
    void fetch("/api/company/price-book?level=residential")
      .then((r) => r.json())
      .then((json: { items?: PriceItem[] }) => {
        if (json.items) setItems(json.items);
        setPricesLoaded(true);
      })
      .catch(() => undefined);
  }, [section, pricesLoaded]);

  useEffect(() => {
    if (section !== "recipe" || recipeLoaded) return;
    void fetch("/api/company/estimate-recipe?level=residential")
      .then((r) => r.json())
      .then((json: { recipe?: EstimateRecipe; isDefault?: boolean }) => {
        if (json.recipe) setRecipe(json.recipe);
        setRecipeDefault(json.isDefault !== false);
        setRecipeLoaded(true);
      })
      .catch(() => undefined);
  }, [section, recipeLoaded]);

  useEffect(() => {
    if (section !== "team" || membersLoaded) return;
    void loadMembers();
  }, [section, membersLoaded]);

  useEffect(() => {
    if (section !== "markets" || marketsLoaded) return;
    void loadMarkets();
  }, [section, marketsLoaded]);

  async function loadMembers() {
    try {
      const res = await fetch("/api/company/members");
      const json = (await res.json()) as {
        members?: Member[];
        designerCapacity?: number;
        paidDesignerSeats?: number;
        extraDesignerSeats?: number;
        trialActive?: boolean;
      };
      if (json.members) setMembers(json.members);
      if (typeof json.designerCapacity === "number") {
        setDesignerCapacity(json.designerCapacity);
      }
      if (typeof json.paidDesignerSeats === "number") {
        setPaidDesignerSeats(json.paidDesignerSeats);
      }
      if (typeof json.extraDesignerSeats === "number") {
        setExtraDesignerSeats(json.extraDesignerSeats);
      }
      if (typeof json.trialActive === "boolean") {
        setTrialActive(json.trialActive);
      }
    } catch {
      setTeamMsg("Could not load the team.");
    } finally {
      setMembersLoaded(true);
    }
  }

  async function loadMarkets() {
    try {
      const res = await fetch("/api/company/markets");
      const json = (await res.json()) as {
        total?: number;
        unlabeled?: number;
        byState?: MarketStateRow[];
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || "Could not load markets");
      setMarkets({
        total: json.total ?? 0,
        unlabeled: json.unlabeled ?? 0,
        byState: json.byState ?? [],
      });
    } catch {
      setMarkets({ total: 0, unlabeled: 0, byState: [] });
    } finally {
      setMarketsLoaded(true);
    }
  }

  async function toggleRole(
    member: Member,
    role: CompanyStaffRole,
    checked: boolean,
  ) {
    const next = checked
      ? [...new Set([...member.roles, role])]
      : member.roles.filter((r) => r !== role);
    if (next.length === 0) {
      setTeamMsg("Each person needs at least one role.");
      return;
    }
    setBusy(true);
    setTeamMsg(null);
    try {
      const res = await fetch(`/api/company/members/${member.id}/roles`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roles: next }),
      });
      const json = (await res.json()) as {
        error?: string;
        requiresCheckout?: boolean;
        warning?: string;
        monthlyCents?: number;
        roles?: CompanyStaffRole[];
        userId?: string;
      };
      if (res.status === 409 && json.requiresCheckout) {
        setSeatPrompt({
          userId: json.userId ?? member.id,
          roles: json.roles ?? next,
          warning: json.warning || "This role requires a paid designer license.",
          monthlyCents: json.monthlyCents ?? 4000,
        });
        return;
      }
      if (!res.ok) throw new Error(json.error || "Could not update roles");
      await loadMembers();
      router.refresh();
    } catch (err) {
      setTeamMsg(err instanceof Error ? err.message : "Could not update roles");
    } finally {
      setBusy(false);
    }
  }

  async function confirmPaidSeat() {
    if (!seatPrompt) return;
    setSeatBusy(true);
    setTeamMsg(null);
    try {
      const res = await fetch("/api/stripe/checkout-seat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: seatPrompt.userId,
          roles: seatPrompt.roles,
        }),
      });
      const json = (await res.json()) as {
        url?: string;
        error?: string;
        ok?: boolean;
        requiresPlanCheckout?: boolean;
      };
      if (res.status === 409 && json.requiresPlanCheckout) {
        setSeatPrompt(null);
        goTo("billing");
        setTeamMsg(json.error || "Subscribe to Sales or Builder first.");
        return;
      }
      if (!res.ok) throw new Error(json.error || "Checkout failed");
      if (json.url) {
        window.location.href = json.url;
        return;
      }
      setSeatPrompt(null);
      await loadMembers();
      router.refresh();
      setTeamMsg("Designer license added and assigned.");
    } catch (err) {
      setTeamMsg(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setSeatBusy(false);
    }
  }

  async function buyLicense(member: Member) {
    setSeatPrompt({
      userId: member.id,
      roles: member.roles.includes("designer")
        ? member.roles
        : [...member.roles, "designer"],
      warning:
        "This adds a designer license that renews monthly with Stripe. If the license lapses, this person loses CAD access.",
      monthlyCents: DESIGNER_SEAT_MONTHLY_CENTS,
    });
  }

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setProfileMsg(null);
    try {
      const res = await fetch("/api/company/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      setProfile((p) => ({ ...p, ...json }));
      setProfileMsg("Profile saved");
    } catch (err) {
      setProfileMsg(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function sendInvite(e: FormEvent) {
    e.preventDefault();
    setInviteError(null);
    setInviteResult(null);
    setBusy(true);
    try {
      const res = await fetch("/api/company/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: inviteName,
          email: inviteEmail,
          role: inviteRole,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Invite failed");
      setInviteResult({
        temporaryPassword: json.temporaryPassword,
        inviteUrl: json.inviteUrl,
        email: json.email,
      });
      setInviteName("");
      setInviteEmail("");
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Invite failed");
    } finally {
      setBusy(false);
    }
  }

  async function savePriceBook(acceptDefaults: boolean) {
    setBusy(true);
    setPriceMsg(null);
    try {
      const res = await fetch("/api/company/price-book", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          acceptDefaults
            ? { acceptDefaults: true }
            : {
                overrides: items
                  .filter((i) => i.unitPriceCents !== i.defaultUnitPriceCents)
                  .map((i) => ({
                    catalogItemId: i.id,
                    unitPriceCents: i.unitPriceCents,
                  })),
              },
        ),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      setPriceMsg(
        acceptDefaults ? "Using catalog defaults" : "Price overrides saved",
      );
      if (acceptDefaults) {
        setItems((prev) =>
          prev.map((i) => ({
            ...i,
            unitPriceCents: i.defaultUnitPriceCents,
            overridden: false,
          })),
        );
      }
    } catch (err) {
      setPriceMsg(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveRecipe(reset: boolean) {
    setBusy(true);
    setRecipeMsg(null);
    try {
      const res = await fetch("/api/company/estimate-recipe", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reset ? { reset: true } : { recipe }),
      });
      const json = (await res.json()) as {
        error?: string;
        recipe?: EstimateRecipe;
      };
      if (!res.ok) throw new Error(json.error || "Save failed");
      if (reset) {
        setRecipeLoaded(false);
        setRecipeMsg("Back to PoolShape default takeoff");
      } else {
        if (json.recipe) setRecipe(json.recipe);
        setRecipeDefault(false);
        setRecipeMsg("Estimate recipe saved — jobs will use these lines");
      }
    } catch (err) {
      setRecipeMsg(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  const active = NAV.find((item) => item.id === section) ?? NAV[0];

  return (
    <div className="admin-layout">
      <nav className="panel admin-nav" aria-label="Company settings">
        <div>
          <h1 className="admin-nav-title">Company admin</h1>
          <p
            className="muted admin-nav-sub"
            title={`${profile.slug}.${rootDomain}`}
          >
            {profile.slug}.{rootDomain}
          </p>
        </div>
        <div className="admin-nav-list" role="tablist">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={section === item.id}
              className={`admin-nav-item${section === item.id ? " active" : ""}`}
              data-tour={`admin-nav-${item.id}`}
              onClick={() => goTo(item.id)}
            >
              <strong>{item.label}</strong>
              <span className="muted">{item.hint}</span>
            </button>
          ))}
        </div>
      </nav>

      <section className="panel stack admin-pane" role="tabpanel">
        <div>
          <h2 style={{ margin: 0 }}>{active.label}</h2>
          <p className="muted" style={{ margin: "0.35rem 0 0" }}>
            {active.hint}
          </p>
        </div>

        {section === "company" ? (
          <form className="stack" onSubmit={(e) => void saveProfile(e)}>
            <div className="field">
              <label htmlFor="companyName">Company name</label>
              <input
                id="companyName"
                value={profile.name}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, name: e.target.value }))
                }
                required
              />
            </div>
            <p className="muted" style={{ margin: 0 }}>
              Headquarters address. Job sites use the same fields so Markets can
              show where work is coming from.
            </p>
            <AddressFields
              idPrefix="hq"
              value={{
                street: profile.street,
                city: profile.city,
                state: profile.state,
                postalCode: profile.postalCode,
                country: profile.country ?? "US",
              }}
              onChange={(next) =>
                setProfile((p) => ({
                  ...p,
                  street: next.street ?? null,
                  city: next.city ?? null,
                  state: next.state ?? null,
                  postalCode: next.postalCode ?? null,
                  country: next.country ?? "US",
                }))
              }
            />
            <div className="field">
              <label htmlFor="region">Service area</label>
              <input
                id="region"
                value={profile.region ?? ""}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, region: e.target.value }))
                }
                placeholder="e.g. Central Florida"
              />
            </div>
            <div className="field">
              <label htmlFor="logoUrl">Logo URL</label>
              <input
                id="logoUrl"
                value={profile.logoUrl ?? ""}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, logoUrl: e.target.value }))
                }
                placeholder="https://…"
              />
            </div>
            <div className="field">
              <label htmlFor="units">Default units</label>
              <select
                id="units"
                value={profile.defaultUnitSystem}
                onChange={(e) =>
                  setProfile((p) => ({
                    ...p,
                    defaultUnitSystem: e.target.value as "imperial" | "metric",
                  }))
                }
              >
                <option value="imperial">Imperial</option>
                <option value="metric">Metric</option>
              </select>
            </div>
            <button className="btn" type="submit" disabled={busy}>
              Save profile
            </button>
            {profileMsg ? <p className="muted">{profileMsg}</p> : null}
          </form>
        ) : null}

        {section === "team" ? (
          <>
            <div className="stack">
              <h3 style={{ margin: 0 }}>Permissions</h3>
              <p className="muted" style={{ margin: 0 }}>
                {trialActive
                  ? `During the trial, every designer can use CAD. Sales and Builder include one designer seat; extras are ${formatMoney(DESIGNER_SEAT_MONTHLY_CENTS)}/month and are added when you subscribe.`
                  : `Assign every role a person needs. Admin and estimator are included. Extra designer seats are ${formatMoney(DESIGNER_SEAT_MONTHLY_CENTS)}/month on your Sales or Builder subscription and stay valid only while that license renews.`}
              </p>
              <p className="muted" style={{ margin: 0 }}>
                {trialActive
                  ? extraDesignerSeats > 0
                    ? `Trial: ${designerCapacity} designer${designerCapacity === 1 ? "" : "s"} licensed. Checkout will add ${extraDesignerSeats} extra seat${extraDesignerSeats === 1 ? "" : "s"}.`
                    : `Trial: ${designerCapacity} designer${designerCapacity === 1 ? "" : "s"} licensed. No extra seats yet.`
                  : `Designer seats: ${designerCapacity} available (${paidDesignerSeats} paid extra).`}
              </p>
              {teamMsg ? <p className="muted">{teamMsg}</p> : null}
              <div className="proposal-table-wrap">
                <table className="proposal-table team-perm-table">
                  <thead>
                    <tr>
                      <th>Person</th>
                      {COMPANY_STAFF_ROLES.map((role) => (
                        <th key={role}>{STAFF_ROLE_LABELS[role]}</th>
                      ))}
                      <th>CAD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((member) => (
                      <tr key={member.id}>
                        <td>
                          <strong>{member.name}</strong>
                          {member.isSelf ? " (you)" : ""}
                          <div className="muted admin-nav-sub" title={member.email}>
                            {member.email}
                          </div>
                        </td>
                        {COMPANY_STAFF_ROLES.map((role) => (
                          <td key={role}>
                            <label className="team-perm-check">
                              <input
                                type="checkbox"
                                aria-label={`${STAFF_ROLE_LABELS[role]} for ${member.name}`}
                                checked={member.roles.includes(role)}
                                disabled={busy}
                                onChange={(e) =>
                                  void toggleRole(member, role, e.target.checked)
                                }
                              />
                            </label>
                          </td>
                        ))}
                        <td>
                          {member.roles.includes("designer") ? (
                            member.designerLicensed ? (
                              <span>Licensed</span>
                            ) : (
                              <button
                                type="button"
                                className="btn secondary"
                                disabled={busy}
                                onClick={() => void buyLicense(member)}
                              >
                                Buy license
                              </button>
                            )
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <form className="stack" onSubmit={(e) => void sendInvite(e)}>
              <h3 style={{ margin: 0 }}>Invite teammate</h3>
              <p className="muted" style={{ margin: 0 }}>
                {trialActive
                  ? "Invite a designer during the trial — extra seats are free until you subscribe. Share the link and one-time password."
                  : `Creates an invite link and one-time temporary password. Extra designer seats are ${formatMoney(DESIGNER_SEAT_MONTHLY_CENTS)}/month on your plan.`}
              </p>
              <div className="grid-2">
                <div className="field">
                  <label htmlFor="inviteName">Name</label>
                  <input
                    id="inviteName"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="inviteEmail">Email</label>
                  <input
                    id="inviteEmail"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="field">
                <label htmlFor="inviteRole">Role</label>
                <select
                  id="inviteRole"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                >
                  <option value="designer">Designer</option>
                  <option value="estimator">Estimator</option>
                  <option value="company_admin">Company admin</option>
                </select>
              </div>
              <button className="btn" type="submit" disabled={busy}>
                Send invite
              </button>
              {inviteError ? (
                <p style={{ color: "var(--danger)" }}>{inviteError}</p>
              ) : null}
              {inviteResult ? (
                <div className="panel" style={{ background: "var(--accent-soft)" }}>
                  <p>
                    Invite for <strong>{inviteResult.email}</strong>
                  </p>
                  <p>
                    Link:{" "}
                    <a
                      href={inviteResult.inviteUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {inviteResult.inviteUrl}
                    </a>
                  </p>
                  <p>
                    Temporary password:{" "}
                    <code>{inviteResult.temporaryPassword}</code>
                  </p>
                  <p className="muted">
                    Copy these now — the password is only shown once.
                  </p>
                </div>
              ) : null}
            </form>
          </>
        ) : null}

        {section === "markets" ? (
          <div className="stack">
            <p className="muted" style={{ margin: 0 }}>
              Counts jobs by job-site city and state. Add city and state when
              you create a project so this stays useful.
            </p>
            {!marketsLoaded ? (
              <p className="muted">Loading markets…</p>
            ) : !markets || markets.total === 0 ? (
              <p className="muted">No projects yet.</p>
            ) : (
              <>
                <p className="muted" style={{ margin: 0 }}>
                  {markets.total} job{markets.total === 1 ? "" : "s"}
                  {markets.unlabeled > 0
                    ? ` · ${markets.unlabeled} without a city or state`
                    : ""}
                </p>
                <div className="proposal-table-wrap">
                  <table className="proposal-table">
                    <thead>
                      <tr>
                        <th>State</th>
                        <th>City</th>
                        <th>Jobs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {markets.byState.map((row) => (
                        <Fragment key={row.state}>
                          <tr>
                            <td>
                              <strong>{row.state}</strong>
                            </td>
                            <td className="muted">All cities</td>
                            <td>
                              <strong>{row.count}</strong>
                            </td>
                          </tr>
                          {row.cities.map((city) => (
                            <tr key={`${row.state}-${city.city}`}>
                              <td />
                              <td>{city.city}</td>
                              <td>{city.count}</td>
                            </tr>
                          ))}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        ) : null}

        {section === "prices" ? (
          <div className="stack">
            <p className="muted" style={{ margin: 0 }}>
              Override catalog unit prices for estimates, or accept defaults.
              To change <em>what</em> is billed from the plan (pavers, seat
              tile, plumbing), use Estimate recipe.
            </p>
            <div className="row">
              <button
                type="button"
                className="btn secondary"
                disabled={busy}
                onClick={() => void savePriceBook(true)}
              >
                Accept defaults
              </button>
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => void savePriceBook(false)}
              >
                Save overrides
              </button>
            </div>
            {priceMsg ? <p className="muted">{priceMsg}</p> : null}
            <div className="proposal-table-wrap">
              <table className="proposal-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Default</th>
                    <th>Your price (USD)</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        {item.name}
                        <div className="muted">
                          {item.category} · {item.unit}
                        </div>
                      </td>
                      <td>{formatMoney(item.defaultUnitPriceCents)}</td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={(item.unitPriceCents / 100).toFixed(2)}
                          onChange={(e) => {
                            const dollars = Number(e.target.value);
                            const cents = Number.isFinite(dollars)
                              ? Math.round(dollars * 100)
                              : item.defaultUnitPriceCents;
                            setItems((prev) =>
                              prev.map((row) =>
                                row.id === item.id
                                  ? {
                                      ...row,
                                      unitPriceCents: cents,
                                      overridden:
                                        cents !== row.defaultUnitPriceCents,
                                    }
                                  : row,
                              ),
                            );
                          }}
                          style={{ width: "7rem" }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {section === "recipe" ? (
          <div className="stack">
            <p className="muted" style={{ margin: 0 }}>
              This is the fillable form behind every job estimate: each line
              pulls a quantity from the plan (paver SF, spa seat perimeter,
              plumbing LF, …), then multiplies by your unit price. Sales still
              uses the result; only Builder can edit the recipe.
            </p>
            {!canEditRecipe ? (
              <p className="muted" style={{ margin: 0 }}>
                Upgrade to Builder to save a company recipe. Until then,
                estimates use the PoolShape catalog and price book.
              </p>
            ) : null}
            {recipeDefault ? (
              <p className="muted" style={{ margin: 0 }}>
                Showing PoolShape defaults. Save to use this recipe on every
                project.
              </p>
            ) : (
              <p className="muted" style={{ margin: 0 }}>
                This company has a saved recipe. Jobs in Estimate / BOM use it
                instead of the built-in takeoff mapping.
              </p>
            )}
            <div className="row" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
              <button
                type="button"
                className="btn"
                disabled={busy || !canEditRecipe || !recipe}
                onClick={() => void saveRecipe(false)}
              >
                Save recipe
              </button>
              <button
                type="button"
                className="btn secondary"
                disabled={busy || !canEditRecipe}
                onClick={() => void saveRecipe(true)}
              >
                Reset to defaults
              </button>
            </div>
            {recipeMsg ? <p className="muted">{recipeMsg}</p> : null}
            {recipe ? (
              <EstimateRecipeEditor
                recipe={recipe}
                onChange={setRecipe}
                disabled={!canEditRecipe}
              />
            ) : (
              <p className="muted">Loading recipe…</p>
            )}
          </div>
        ) : null}

        {section === "billing" ? (
          <div className="stack">
            <BillingActions
              hasCustomer={billing.hasCustomer}
              planKey={billing.planKey}
              status={billing.status}
              trialEndsAt={billing.trialEndsAt}
              extraDesignerSeats={extraDesignerSeats}
            />
            <div className="muted">
              Stripe customer: {billing.stripeCustomerId || "Not connected yet"}
            </div>
          </div>
        ) : null}
      </section>
      {seatPrompt ? (
        <div className="modal-backdrop" role="presentation">
          <div
            className="panel stack modal-card"
            role="dialog"
            aria-labelledby="seat-prompt-title"
          >
            <h2 id="seat-prompt-title" style={{ margin: 0 }}>
              Extra designer license
            </h2>
            <p style={{ margin: 0 }}>{seatPrompt.warning}</p>
            <p className="muted" style={{ margin: 0 }}>
              {formatMoney(seatPrompt.monthlyCents)}/month, billed by Stripe
              with your subscription.
            </p>
            <div className="row">
              <button
                type="button"
                className="btn"
                disabled={seatBusy}
                onClick={() => void confirmPaidSeat()}
              >
                {seatBusy ? "Continuing…" : "Add paid license"}
              </button>
              <button
                type="button"
                className="btn secondary"
                disabled={seatBusy}
                onClick={() => setSeatPrompt(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
