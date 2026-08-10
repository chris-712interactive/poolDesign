"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function AcceptInviteForm({ token }: { token: string }) {
  const router = useRouter();
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/company/invites/${token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ temporaryPassword, newPassword }),
      });
      const json = (await res.json()) as { error?: string; redirectTo?: string };
      if (!res.ok) throw new Error(json.error || "Could not accept invite");
      router.push(json.redirectTo || "/app");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={(e) => void onSubmit(e)}>
      <div className="field">
        <label htmlFor="temporaryPassword">Temporary password</label>
        <input
          id="temporaryPassword"
          type="password"
          value={temporaryPassword}
          onChange={(e) => setTemporaryPassword(e.target.value)}
          required
          autoComplete="off"
        />
      </div>
      <div className="field">
        <label htmlFor="newPassword">Choose a new password (optional)</label>
        <input
          id="newPassword"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          minLength={8}
          placeholder="At least 8 characters"
          autoComplete="new-password"
        />
      </div>
      {error ? <p style={{ color: "var(--danger)" }}>{error}</p> : null}
      <button className="btn" type="submit" disabled={busy}>
        {busy ? "Joining…" : "Join company"}
      </button>
    </form>
  );
}
