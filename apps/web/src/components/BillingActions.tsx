"use client";

import { useState } from "react";
import {
  DESIGNER_SEAT_MONTHLY_CENTS,
  formatMoney,
  PLAN_MARKETING,
  PLAN_PRICING,
  planDisplayName,
  trialDaysRemaining,
} from "@pool-design/shared";

type Props = {
  hasCustomer: boolean;
  planKey: string;
  status: string;
  trialEndsAt?: string | Date | null;
  extraDesignerSeats?: number;
};

export function BillingActions({
  hasCustomer,
  planKey,
  status,
  trialEndsAt,
  extraDesignerSeats = 0,
}: Props) {
  const [busy, setBusy] = useState<"checkout" | "portal" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const daysLeft = trialDaysRemaining({
    subscriptionStatus: status,
    trialEndsAt: trialEndsAt ?? null,
  });
  const converting = status === "trialing" || status === "canceled";

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
      {daysLeft != null ? (
        <p className="muted" style={{ margin: 0 }}>
          <strong>
            {daysLeft === 0
              ? "Trial ends today."
              : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left in your trial.`}
          </strong>{" "}
          Full Builder features are unlocked until then. No card on file — pick a
          plan when you are ready.
        </p>
      ) : null}
      {converting ? (
        <p className="muted" style={{ margin: 0 }}>
          {extraDesignerSeats > 0
            ? `Checkout includes ${extraDesignerSeats} extra designer license${
                extraDesignerSeats === 1 ? "" : "s"
              } at ${formatMoney(DESIGNER_SEAT_MONTHLY_CENTS)}/mo each. One designer seat is included with Sales and Builder.`
            : `Sales and Builder include one designer seat. Extra seats are ${formatMoney(DESIGNER_SEAT_MONTHLY_CENTS)}/mo and are added at checkout if the team has more designers.`}
        </p>
      ) : null}
      <div className="grid-2">
        <div className="stack">
          <strong>{PLAN_MARKETING.sales.name}</strong>
          <span className="muted">
            {formatMoney(PLAN_PRICING.sales.monthlyCents)}/mo · company
          </span>
          <p className="muted" style={{ margin: 0 }}>
            {PLAN_MARKETING.sales.blurb}
          </p>
          <button
            type="button"
            className="btn secondary"
            disabled={busy !== null}
            onClick={() => void startCheckout("starter")}
          >
            {busy === "checkout"
              ? "Redirecting…"
              : converting
                ? "Subscribe to Sales"
                : "Switch to Sales"}
          </button>
        </div>
        <div className="stack">
          <strong>{PLAN_MARKETING.builder.name}</strong>
          <span className="muted">
            {formatMoney(PLAN_PRICING.builder.monthlyCents)}/mo · company
          </span>
          <p className="muted" style={{ margin: 0 }}>
            {PLAN_MARKETING.builder.blurb}
          </p>
          <button
            type="button"
            className="btn"
            disabled={busy !== null}
            onClick={() => void startCheckout("pro")}
          >
            {busy === "checkout"
              ? "Redirecting…"
              : converting
                ? "Subscribe to Builder"
                : "Switch to Builder"}
          </button>
        </div>
      </div>
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
      <p className="muted">
        Current plan: {planDisplayName(planKey)} · status: {status}
        {status === "trialing"
          ? " · Trial is billed by PoolShape, not Stripe"
          : ""}
      </p>
      {error ? <p style={{ color: "var(--danger)" }}>{error}</p> : null}
    </div>
  );
}
