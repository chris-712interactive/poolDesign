"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type Path = "self" | "invite" | "both";

type InviteResult = {
  email: string;
  inviteUrl: string;
  temporaryPassword: string;
};

export function SetupWizardClient({ companyName }: { companyName: string }) {
  const router = useRouter();
  const [path, setPath] = useState<Path>("self");
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invite, setInvite] = useState<InviteResult | null>(null);

  const needsInvite = path === "invite" || path === "both";

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
        }),
      });
      const json = (await res.json()) as {
        error?: string;
        invite?: InviteResult | null;
      };
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
        <p>
          Share this with <strong>{invite.email}</strong>. The password is only
          shown once.
        </p>
        <p>
          Link:{" "}
          <a href={invite.inviteUrl} target="_blank" rel="noreferrer">
            {invite.inviteUrl}
          </a>
        </p>
        <p>
          Temporary password: <code>{invite.temporaryPassword}</code>
        </p>
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

  return (
    <form
      className="panel stack"
      style={{ maxWidth: 560, margin: "0 auto" }}
      onSubmit={(e) => void submit(e)}
    >
      <h1>Set up {companyName}</h1>
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

      <button className="btn" type="submit" disabled={busy}>
        {busy ? "Saving…" : "Continue"}
      </button>
    </form>
  );
}
