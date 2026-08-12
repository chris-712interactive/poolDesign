"use client";

import { useCallback, useEffect, useState } from "react";
import {
  WATERLINE_TILES,
  type LiveSessionFinishes,
  type LiveSessionState,
  type PlanEntitlements,
} from "@pool-design/shared";

export type LiveSessionStatus = {
  active: boolean;
  guestConnected: boolean;
  tileName: string | null;
  canApplyFinishes: boolean;
  finishes: LiveSessionFinishes;
  lastApproval: string | null;
  error: string | null;
};

type Props = {
  projectId: string;
  entitlements: PlanEntitlements;
  onStatusChange?: (status: LiveSessionStatus) => void;
};

function statusFromState(
  state: LiveSessionState | null,
  error: string | null,
): LiveSessionStatus {
  const finishes = state?.finishes ?? {};
  const tileName = finishes.waterlineTileId
    ? WATERLINE_TILES.find((t) => t.id === finishes.waterlineTileId)?.name ??
      null
    : null;
  const last = state?.approvals?.length
    ? state.approvals[state.approvals.length - 1]
    : null;
  return {
    active: Boolean(state?.active),
    guestConnected: Boolean(state?.guestOnlineAt),
    tileName,
    canApplyFinishes: Boolean(
      state?.active &&
        (finishes.waterlineTileId ||
          (finishes.patioMaterialById &&
            Object.keys(finishes.patioMaterialById).length > 0)),
    ),
    finishes,
    lastApproval: last ? `${last.label} — ${last.status}` : null,
    error,
  };
}

/** Live session toggle — feedback belongs in the parent toolbar status strip. */
export function LiveSessionHostControls({
  projectId,
  entitlements,
  onStatusChange,
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

  useEffect(() => {
    onStatusChange?.(statusFromState(state, error));
  }, [state, error, onStatusChange]);

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

  return (
    <button
      type="button"
      className={`btn ${state?.active ? "" : "secondary"}`}
      disabled={busy}
      onClick={() => void startOrEnd(state?.active ? "end" : "start")}
      title="Start a live session so the client can tweak finishes on their share link"
    >
      {busy ? "…" : state?.active ? "End live" : "Live session"}
    </button>
  );
}
