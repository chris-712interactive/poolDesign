"use client";

import { useCallback, useEffect, useState } from "react";
import {
  WATERLINE_TILES,
  type LiveSessionState,
  type PlanEntitlements,
} from "@pool-design/shared";

type Props = {
  projectId: string;
  entitlements: PlanEntitlements;
  /** Apply live finish overrides into the local CAD design. */
  onApplyFinishes?: (finishes: LiveSessionState["finishes"]) => void;
};

export function LiveSessionHostControls({
  projectId,
  entitlements,
  onApplyFinishes,
}: Props) {
  const [state, setState] = useState<LiveSessionState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!entitlements.liveClientSession) return;
    const res = await fetch(`/api/projects/${projectId}/live-session`);
    if (!res.ok) return;
    const json = (await res.json()) as { state: LiveSessionState };
    setState(json.state);
  }, [projectId, entitlements.liveClientSession]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!state?.active) return;
    const t = setInterval(() => void refresh(), 2500);
    return () => clearInterval(t);
  }, [state?.active, refresh]);

  async function startOrEnd(action: "start" | "end") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/live-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = (await res.json()) as {
        state?: LiveSessionState;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || "Failed");
      if (json.state) setState(json.state);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  if (!entitlements.liveClientSession) return null;

  const tileName = state?.finishes.waterlineTileId
    ? WATERLINE_TILES.find((t) => t.id === state.finishes.waterlineTileId)?.name
    : null;

  return (
    <div className="stack" style={{ gap: "0.35rem", alignItems: "flex-end" }}>
      <button
        type="button"
        className={`btn ${state?.active ? "" : "secondary"}`}
        disabled={busy}
        onClick={() => void startOrEnd(state?.active ? "end" : "start")}
        title="Start a live session so the client can tweak finishes on their share link"
      >
        {busy
          ? "…"
          : state?.active
            ? "End live session"
            : "Start live session"}
      </button>
      {state?.active ? (
        <span className="muted" style={{ fontSize: "0.8rem", maxWidth: 220, textAlign: "right" }}>
          Live — client can join via the share link.
          {state.guestOnlineAt ? " Guest connected." : " Waiting for guest…"}
          {tileName ? ` Tile pick: ${tileName}.` : ""}
        </span>
      ) : null}
      {state?.active && state.finishes.waterlineTileId && onApplyFinishes ? (
        <button
          type="button"
          className="btn secondary"
          style={{ fontSize: "0.8rem", padding: "0.35rem 0.55rem" }}
          onClick={() => onApplyFinishes(state.finishes)}
        >
          Apply client finishes to design
        </button>
      ) : null}
      {state?.approvals?.length ? (
        <span className="muted" style={{ fontSize: "0.75rem" }}>
          Last: {state.approvals[state.approvals.length - 1]?.label} —{" "}
          {state.approvals[state.approvals.length - 1]?.status}
        </span>
      ) : null}
      {error ? <span style={{ color: "var(--danger)" }}>{error}</span> : null}
    </div>
  );
}
