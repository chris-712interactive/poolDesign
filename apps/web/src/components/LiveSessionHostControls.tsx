"use client";

import { useCallback, useEffect, useState } from "react";
import {
  PATIO_FINISHES,
  WATERLINE_TILES,
  liveFinishesPending,
  type LiveSessionFinishes,
  type LiveSessionState,
  type PlanEntitlements,
} from "@pool-design/shared";

export type LiveSessionStatus = {
  active: boolean;
  guestConnected: boolean;
  /** Human-readable pending finish payload (tile + patio). Null after apply. */
  pendingSummary: string | null;
  canApplyFinishes: boolean;
  finishes: LiveSessionFinishes;
  lastApproval: string | null;
  showEstimate: boolean;
  previewImageUrl: string | null;
  error: string | null;
};

type Props = {
  projectId: string;
  entitlements: PlanEntitlements;
  ensure3d?: () => void;
  capturePreview?: () => string | null;
  onStatusChange?: (status: LiveSessionStatus) => void;
  /** Fired when live start creates/returns a client share link. */
  onShareReady?: (share: { shareId: string; url: string }) => void;
};

function pendingFinishSummary(finishes: LiveSessionFinishes): string | null {
  const parts: string[] = [];
  if (finishes.waterlineTileId) {
    const tile = WATERLINE_TILES.find((t) => t.id === finishes.waterlineTileId);
    if (tile) parts.push(tile.name);
  }
  const patioIds = [
    ...new Set(Object.values(finishes.patioMaterialById ?? {})),
  ];
  for (const id of patioIds) {
    const patio = PATIO_FINISHES.find((f) => f.id === id);
    if (patio) parts.push(patio.name);
  }
  return parts.length ? parts.join(" · ") : null;
}

function statusFromState(
  state: LiveSessionState | null,
  error: string | null,
): LiveSessionStatus {
  const finishes = state?.finishes ?? {};
  const pending = Boolean(
    state?.active && liveFinishesPending(finishes, state?.appliedFinishesKey),
  );
  const last = state?.approvals?.length
    ? state.approvals[state.approvals.length - 1]
    : null;
  return {
    active: Boolean(state?.active),
    guestConnected: Boolean(state?.guestOnlineAt),
    pendingSummary: pending ? pendingFinishSummary(finishes) : null,
    canApplyFinishes: pending,
    finishes,
    lastApproval: pending && last ? `${last.label} — ${last.status}` : null,
    showEstimate: Boolean(state?.showEstimate),
    previewImageUrl: state?.previewImageUrl ?? null,
    error,
  };
}

async function uploadPreview(
  projectId: string,
  capturePreview?: () => string | null,
): Promise<string | null> {
  const dataUrl = capturePreview?.() ?? null;
  if (!dataUrl) return null;
  const up = await fetch(`/api/projects/${projectId}/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dataUrl }),
  });
  if (!up.ok) return null;
  const json = (await up.json()) as { url?: string };
  return json.url ?? null;
}

/** Live session toggle — captures a 3D still on start for the client. */
export function LiveSessionHostControls({
  projectId,
  entitlements,
  ensure3d,
  capturePreview,
  onStatusChange,
  onShareReady,
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
      let previewImageUrl: string | null = null;
      if (action === "start") {
        ensure3d?.();
        // Let the 3D canvas mount / settle before capture.
        await new Promise((r) => setTimeout(r, ensure3d ? 700 : 0));
        previewImageUrl = await uploadPreview(projectId, capturePreview);
        if (!previewImageUrl) {
          // Retry once after a bit more settle time
          await new Promise((r) => setTimeout(r, 500));
          previewImageUrl = await uploadPreview(projectId, capturePreview);
        }
      }

      const res = await fetch(`/api/projects/${projectId}/live-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          ...(previewImageUrl ? { previewImageUrl } : {}),
        }),
      });
      const json = (await res.json()) as {
        state?: LiveSessionState;
        error?: string;
        share?: { shareId: string; url: string };
      };
      if (!res.ok) throw new Error(json.error || "Failed");
      if (json.state) setState(json.state);

      if (action === "start" && !previewImageUrl) {
        setError(
          "Live started, but no 3D still captured — open Design 3D and use Update still.",
        );
      }

      if (action === "start" && json.share && onShareReady) {
        onShareReady(json.share);
      }
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
      title="Start a live session and send a 3D still to the client link"
    >
      {busy ? "…" : state?.active ? "End live" : "Live session"}
    </button>
  );
}
