"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { USER_ROLE_LABELS, type UserRole } from "@pool-design/shared";
import {
  type AccountSection,
  parseAccountSection,
} from "@/lib/accountSections";

type Profile = {
  name: string;
  email: string;
  role: string;
  companyName: string | null;
  alsoDesigner: boolean;
  unitSystem: "imperial" | "metric";
};

const ALL_NAV: {
  id: AccountSection;
  label: string;
  hint: string;
  unitsOnly?: boolean;
}[] = [
  {
    id: "profile",
    label: "Profile",
    hint: "Name, email, role, and company",
  },
  {
    id: "units",
    label: "Units",
    hint: "Feet and inches or metric",
    unitsOnly: true,
  },
  {
    id: "password",
    label: "Password",
    hint: "Change the password for this login",
  },
];

type Props = {
  showUnits: boolean;
  initialProfile: Profile;
  initialSection?: AccountSection;
};

export function AccountSettingsClient({
  showUnits,
  initialProfile,
  initialSection = "profile",
}: Props) {
  const router = useRouter();
  const nav = ALL_NAV.filter((item) => showUnits || !item.unitsOnly);
  const allowed = nav.map((item) => item.id);
  const [section, setSection] = useState<AccountSection>(
    parseAccountSection(initialSection, allowed),
  );
  const [profile, setProfile] = useState(initialProfile);
  const [unitSystem, setUnitSystem] = useState(initialProfile.unitSystem);
  const [busy, setBusy] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [unitsMsg, setUnitsMsg] = useState<string | null>(null);
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  function goTo(next: AccountSection) {
    setSection(next);
    router.replace(`/app/settings?section=${next}`, { scroll: false });
  }

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setProfileMsg(null);
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: profile.name, email: profile.email }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      setProfile((p) => ({ ...p, name: json.name, email: json.email }));
      setProfileMsg("Profile saved");
      router.refresh();
    } catch (err) {
      setProfileMsg(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveUnits(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setUnitsMsg(null);
    try {
      const res = await fetch("/api/account/units", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitSystem }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      setUnitSystem(json.unitSystem);
      setUnitsMsg("Units saved");
      router.refresh();
    } catch (err) {
      setUnitsMsg(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setPasswordMsg(null);
    setPasswordError(null);
    try {
      const res = await fetch("/api/account/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not update password");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMsg("Password updated. You are still signed in.");
    } catch (err) {
      setPasswordError(
        err instanceof Error ? err.message : "Could not update password",
      );
    } finally {
      setBusy(false);
    }
  }

  const active = nav.find((item) => item.id === section) ?? nav[0];
  const roleLabel =
    USER_ROLE_LABELS[profile.role as UserRole] ?? profile.role;

  return (
    <div className="admin-layout">
      <nav className="panel admin-nav" aria-label="Account">
        <div>
          <h1 className="admin-nav-title">Account</h1>
          <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.85rem" }}>
            {profile.email}
          </p>
        </div>
        <div className="admin-nav-list" role="tablist">
          {nav.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={section === item.id}
              className={`admin-nav-item${section === item.id ? " active" : ""}`}
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

        {section === "profile" ? (
          <>
            <dl className="account-meta">
              <div>
                <dt>Role</dt>
                <dd>{roleLabel}</dd>
              </div>
              {profile.companyName ? (
                <div>
                  <dt>Company</dt>
                  <dd>{profile.companyName}</dd>
                </div>
              ) : null}
              {profile.role === "company_admin" ? (
                <div>
                  <dt>Designer seat</dt>
                  <dd>
                    {profile.alsoDesigner
                      ? "Yes — you can open CAD"
                      : "No"}
                  </dd>
                </div>
              ) : null}
            </dl>
            <form className="stack" onSubmit={(e) => void saveProfile(e)}>
              <div className="field">
                <label htmlFor="name">Name</label>
                <input
                  id="name"
                  value={profile.name}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, name: e.target.value }))
                  }
                  required
                  autoComplete="name"
                />
              </div>
              <div className="field">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  value={profile.email}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, email: e.target.value }))
                  }
                  required
                  autoComplete="email"
                />
              </div>
              <button className="btn" type="submit" disabled={busy}>
                Save profile
              </button>
              {profileMsg ? <p className="muted">{profileMsg}</p> : null}
            </form>
          </>
        ) : null}

        {section === "units" && showUnits ? (
          <form className="stack" onSubmit={(e) => void saveUnits(e)}>
            <p className="muted" style={{ margin: 0 }}>
              Your preference across projects. Geometry is stored canonically
              so teammates can use either system.
            </p>
            <div className="field">
              <label htmlFor="unitSystem">Units of measure</label>
              <select
                id="unitSystem"
                value={unitSystem}
                onChange={(e) =>
                  setUnitSystem(e.target.value as "imperial" | "metric")
                }
              >
                <option value="imperial">
                  Imperial (ft / in, snap 1/32&quot;)
                </option>
                <option value="metric">Metric (m / cm / mm, snap 1 mm)</option>
              </select>
            </div>
            <button className="btn" type="submit" disabled={busy}>
              Save units
            </button>
            {unitsMsg ? <p className="muted">{unitsMsg}</p> : null}
          </form>
        ) : null}

        {section === "password" ? (
          <form className="stack" onSubmit={(e) => void savePassword(e)}>
            <p className="muted" style={{ margin: 0 }}>
              Choose a new password for this account. You will stay signed in.
            </p>
            <div className="field">
              <label htmlFor="currentPassword">Current password</label>
              <input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <div className="field">
              <label htmlFor="newPassword">New password</label>
              <input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <div className="field">
              <label htmlFor="confirmPassword">Confirm new password</label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <button className="btn" type="submit" disabled={busy}>
              Update password
            </button>
            {passwordError ? <p className="error">{passwordError}</p> : null}
            {passwordMsg ? <p className="success">{passwordMsg}</p> : null}
          </form>
        ) : null}
      </section>
    </div>
  );
}
