"use client";

import { useEffect, useState, type FormEvent } from "react";
import { formatMoney } from "@pool-design/shared";
import { BillingActions } from "@/components/BillingActions";

type Profile = {
  name: string;
  logoUrl: string | null;
  region: string | null;
  defaultUnitSystem: "imperial" | "metric";
  slug: string;
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

type Props = {
  alsoDesigner: boolean;
  initialProfile: Profile;
  billing: {
    planKey: string;
    status: string;
    hasCustomer: boolean;
    stripeCustomerId: string | null;
    trialEndsAt: string | null;
  };
  rootDomain: string;
};

export function CompanyAdminClient({
  alsoDesigner: alsoDesignerInitial,
  initialProfile,
  billing,
  rootDomain,
}: Props) {
  const [profile, setProfile] = useState(initialProfile);
  const [alsoDesigner, setAlsoDesigner] = useState(alsoDesignerInitial);
  const [alsoDesignerMsg, setAlsoDesignerMsg] = useState<string | null>(null);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("designer");
  const [inviteResult, setInviteResult] = useState<InviteResult>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [items, setItems] = useState<PriceItem[]>([]);
  const [priceMsg, setPriceMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetch("/api/company/price-book?level=residential")
      .then((r) => r.json())
      .then((json: { items?: PriceItem[] }) => {
        if (json.items) setItems(json.items);
      })
      .catch(() => undefined);
  }, []);

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

  async function toggleAlsoDesigner(next: boolean) {
    setAlsoDesignerMsg(null);
    setAlsoDesigner(next);
    try {
      const res = await fetch("/api/company/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alsoDesigner: next }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not update designer seat");
      setAlsoDesigner(json.alsoDesigner === true);
      setAlsoDesignerMsg(
        json.alsoDesigner
          ? "You can open CAD on this account."
          : "CAD is limited to invited designers.",
      );
    } catch (err) {
      setAlsoDesigner(!next);
      setAlsoDesignerMsg(
        err instanceof Error ? err.message : "Could not update designer seat",
      );
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
        acceptDefaults
          ? "Using catalog defaults"
          : "Price overrides saved",
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

  return (
    <div className="stack">
      <div className="panel">
        <h1>Company admin</h1>
        <p className="muted">
          Profile, team invites, price book, and billing. Subdomain:{" "}
          <strong>
            {profile.slug}.{rootDomain}
          </strong>
        </p>
      </div>

      <div className="panel stack">
        <h2>Your designer seat</h2>
        <p className="muted">
          Company admin is for billing and team. Check this to also open CAD
          yourself — or invite a designer below.
        </p>
        <label className="row" style={{ gap: "0.6rem", alignItems: "center" }}>
          <input
            type="checkbox"
            checked={alsoDesigner}
            disabled={busy}
            onChange={(e) => void toggleAlsoDesigner(e.target.checked)}
          />
          I also design (open CAD on this account)
        </label>
        {alsoDesignerMsg ? <p className="muted">{alsoDesignerMsg}</p> : null}
      </div>

      <div className="grid-2">
        <form className="panel stack" onSubmit={(e) => void saveProfile(e)}>
          <h2>Company profile</h2>
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
          <div className="field">
            <label htmlFor="region">Region</label>
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

        <div className="panel stack">
          <h2>Billing</h2>
          <BillingActions
            hasCustomer={billing.hasCustomer}
            planKey={billing.planKey}
            status={billing.status}
            trialEndsAt={billing.trialEndsAt}
          />
          <div className="muted">
            Stripe customer: {billing.stripeCustomerId || "Not connected yet"}
          </div>
        </div>
      </div>

      <form className="panel stack" onSubmit={(e) => void sendInvite(e)}>
        <h2>Invite teammate</h2>
        <p className="muted">
          Creates an invite link and one-time temporary password. Share both with
          the teammate. You can invite a designer even if you also design.
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
              <a href={inviteResult.inviteUrl} target="_blank" rel="noreferrer">
                {inviteResult.inviteUrl}
              </a>
            </p>
            <p>
              Temporary password:{" "}
              <code>{inviteResult.temporaryPassword}</code>
            </p>
            <p className="muted">Copy these now — the password is only shown once.</p>
          </div>
        ) : null}
      </form>

      <div className="panel stack">
        <h2>Price book (residential)</h2>
        <p className="muted">
          Override catalog unit prices for estimates, or accept defaults.
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
    </div>
  );
}
