"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { AddressParts } from "@pool-design/shared";
import { AddressFields } from "@/components/AddressFields";
import { InviteCreatedNotice } from "@/components/InviteCreatedNotice";

type Path = "self" | "invite" | "both";
type Step = "profile" | "team";

type InviteResult = {
  email: string;
  inviteUrl: string;
  emailSent: boolean;
  emailError: string | null;
  temporaryPassword: string | null;
};

export function SetupWizardClient({ companyName }: { companyName: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("profile");
  const [path, setPath] = useState<Path>("self");
  const [region, setRegion] = useState("");
  const [units, setUnits] = useState<"imperial" | "metric">("imperial");
  const [hq, setHq] = useState<AddressParts>({
    street: "",
    city: "",
    state: "",
    postalCode: "",
    country: "US",
  });
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invite, setInvite] = useState<InviteResult | null>(null);

  const needsInvite = path === "invite" || path === "both";

  function goToTeam(e: FormEvent) {
    e.preventDefault();
    if (!hq.city?.trim() || !hq.state?.trim()) {
      setError("Enter the company city and state.");
      return;
    }
    setError(null);
    setStep("team");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/company/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alsoDesigner: path === "self" || path === "both",
          invite: needsInvite
            ? { name: inviteName, email: inviteEmail }
            : null,
          profile: {
            ...hq,
            region,
            defaultUnitSystem: units,
          },
        }),
      });
      const json = (await res.json()) as {
        error?: string;
        invite?: InviteResult | null;
      };
      if (json.invite) {
        json.invite = {
          ...json.invite,
          emailSent: Boolean(json.invite.emailSent),
          emailError: json.invite.emailError ?? null,
          temporaryPassword: json.invite.temporaryPassword ?? null,
        };
      }
      if (!res.ok) throw new Error(json.error || "Could not save setup");
      if (json.invite) {
        setInvite(json.invite);
        return;
      }
      router.push("/app");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save setup");
    } finally {
      setBusy(false);
    }
  }

  if (invite) {
    return (
      <div className="panel stack" style={{ maxWidth: 560, margin: "0 auto" }}>
        <h1>Invite sent</h1>
        <InviteCreatedNotice
          email={invite.email}
          inviteUrl={invite.inviteUrl}
          emailSent={invite.emailSent}
          emailError={invite.emailError}
          temporaryPassword={invite.temporaryPassword}
        />
        <button
          className="btn"
          type="button"
          onClick={() => {
            router.push("/app");
            router.refresh();
          }}
        >
          Continue to projects
        </button>
      </div>
    );
  }

  if (step === "profile") {
    return (
      <form
        className="panel stack"
        style={{ maxWidth: 560, margin: "0 auto" }}
        onSubmit={goToTeam}
      >
        <p className="muted" style={{ margin: 0 }}>
          Step 1 of 2 · Company profile
        </p>
        <h1>Set up {companyName}</h1>
        <p className="muted">
          Headquarters address and the area you sell in. Job sites use the same
          fields so you can see where work is coming from.
        </p>
        <AddressFields idPrefix="hq" value={hq} onChange={setHq} required />
        <div className="field">
          <label htmlFor="setupRegion">Service area</label>
          <input
            id="setupRegion"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="e.g. Central Florida"
          />
        </div>
        <div className="field">
          <label htmlFor="setupUnits">Default units</label>
          <select
            id="setupUnits"
            value={units}
            onChange={(e) =>
              setUnits(e.target.value as "imperial" | "metric")
            }
          >
            <option value="imperial">Imperial</option>
            <option value="metric">Metric</option>
          </select>
        </div>
        {error ? <p className="error">{error}</p> : null}
        <button className="btn" type="submit">
          Continue
        </button>
      </form>
    );
  }

  return (
    <form
      className="panel stack"
      style={{ maxWidth: 560, margin: "0 auto" }}
      onSubmit={(e) => void submit(e)}
    >
      <p className="muted" style={{ margin: 0 }}>
        Step 2 of 2 · Team
      </p>
      <h1>Who will design?</h1>
      <p className="muted">
        Company admins handle billing. Designers open CAD. Extra designer seats
        are free during the trial.
      </p>

      <div className="setup-choices" role="radiogroup" aria-label="Who will design">
        <button
          type="button"
          className={`setup-choice${path === "self" ? " selected" : ""}`}
          aria-pressed={path === "self"}
          onClick={() => setPath("self")}
        >
          <strong>I&apos;ll design</strong>
          <span className="muted">
            Keep company admin and open CAD yourself.
          </span>
        </button>
        <button
          type="button"
          className={`setup-choice${path === "invite" ? " selected" : ""}`}
          aria-pressed={path === "invite"}
          onClick={() => setPath("invite")}
        >
          <strong>Invite a designer</strong>
          <span className="muted">
            You stay on billing and company settings. They get CAD — extra seats
            are free until you subscribe.
          </span>
        </button>
        <button
          type="button"
          className={`setup-choice${path === "both" ? " selected" : ""}`}
          aria-pressed={path === "both"}
          onClick={() => setPath("both")}
        >
          <strong>Both</strong>
          <span className="muted">
            You design, and you invite a teammate who can design too. Extra
            seats are free during the trial.
          </span>
        </button>
      </div>

      {needsInvite ? (
        <div className="grid-2">
          <div className="field">
            <label htmlFor="setupInviteName">Designer name</label>
            <input
              id="setupInviteName"
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="setupInviteEmail">Designer email</label>
            <input
              id="setupInviteEmail"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              required
            />
          </div>
        </div>
      ) : null}

      {error ? <p className="error">{error}</p> : null}

      <div className="row">
        <button
          className="btn secondary"
          type="button"
          onClick={() => setStep("profile")}
          disabled={busy}
        >
          Back
        </button>
        <button className="btn" type="submit" disabled={busy}>
          {busy ? "Saving…" : "Finish setup"}
        </button>
      </div>
    </form>
  );
}
