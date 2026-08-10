"use client";

import { useState } from "react";

type Props = {
  hasCustomer: boolean;
  planKey: string;
  status: string;
};

export function BillingActions({ hasCustomer, planKey, status }: Props) {
  const [busy, setBusy] = useState<"checkout" | "portal" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout(nextPlan: string) {
    setBusy("checkout");
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planKey: nextPlan }),
      });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error || "Checkout failed");
      window.location.href = json.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
      setBusy(null);
    }
  }

  async function openPortal() {
    setBusy("portal");
    setError(null);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error || "Portal failed");
      window.location.href = json.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Portal failed");
      setBusy(null);
    }
  }

  return (
    <div className="stack">
      <div className="row" style={{ flexWrap: "wrap" }}>
        <button
          type="button"
          className="btn"
          disabled={busy !== null}
          onClick={() => void startCheckout(planKey === "pro" ? "pro" : "starter")}
        >
          {busy === "checkout" ? "Redirecting…" : "Start / upgrade subscription"}
        </button>
        {hasCustomer ? (
          <button
            type="button"
            className="btn secondary"
            disabled={busy !== null}
            onClick={() => void openPortal()}
          >
            {busy === "portal" ? "Opening…" : "Manage billing"}
          </button>
        ) : null}
      </div>
      <p className="muted">
        Current plan: {planKey} · status: {status}
      </p>
      {error ? <p style={{ color: "var(--danger)" }}>{error}</p> : null}
    </div>
  );
}
