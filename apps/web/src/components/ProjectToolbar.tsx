"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  DesignDocument,
  DesignLevel,
  PlanEntitlements,
} from "@pool-design/shared";
import { DESIGN_LEVEL_LABELS, liveFinishesKey } from "@pool-design/shared";
import {
  LiveSessionHostControls,
  type LiveSessionStatus,
} from "@/components/LiveSessionHostControls";
import {
  ShareProposalButton,
  UpdateShareStillButton,
  type ShareResult,
} from "@/components/ShareProposalButton";

type WorkspaceView = "design" | "estimate";

type Props = {
  projectId: string;
  projectName: string;
  designLevel: DesignLevel;
  view: WorkspaceView;
  onViewChange: (view: WorkspaceView) => void;
  entitlements: PlanEntitlements;
  design: DesignDocument;
  onDesignChange: (next: DesignDocument) => void;
  ensure3d: () => void;
  capturePreview: () => string | null;
};

type ActiveShare = { id: string; url: string };

type StripState =
  | { kind: "share"; url: string; copied: boolean; updated?: boolean }
  | { kind: "error"; message: string }
  | null;

function truncateUrl(url: string): string {
  try {
    const u = new URL(url);
    const path =
      u.pathname.length > 18
        ? `${u.pathname.slice(0, 10)}…${u.pathname.slice(-8)}`
        : u.pathname;
    return `${u.host}${path}`;
  } catch {
    return url.length > 42 ? `${url.slice(0, 41)}…` : url;
  }
}

function applyFinishesToDesign(
  design: DesignDocument,
  finishes: LiveSessionStatus["finishes"],
): DesignDocument {
  const tileId = finishes.waterlineTileId;
  const patioAll = finishes.patioMaterialById?.["*"];
  return {
    ...design,
    poolBodies: design.poolBodies.map((b) =>
      tileId ? { ...b, waterlineTileId: tileId } : b,
    ),
    features: (design.features ?? []).map((f) =>
      tileId ? { ...f, waterlineTileId: tileId } : f,
    ),
    patios: design.patios.map((p) => {
      const materialId =
        finishes.patioMaterialById?.[p.id] ?? patioAll ?? undefined;
      return materialId ? { ...p, materialId } : p;
    }),
  };
}

/**
 * Stable project header: one button row + optional status strip below.
 * Share/live feedback never stacks under individual buttons.
 */
export function ProjectToolbar({
  projectId,
  projectName,
  designLevel,
  view,
  onViewChange,
  entitlements,
  design,
  onDesignChange,
  ensure3d,
  capturePreview,
}: Props) {
  const [strip, setStrip] = useState<StripState>(null);
  const [live, setLive] = useState<LiveSessionStatus | null>(null);
  const [includeEstimate, setIncludeEstimate] = useState(false);
  const [estimateBusy, setEstimateBusy] = useState(false);
  const [applyBusy, setApplyBusy] = useState(false);
  const [activeShare, setActiveShare] = useState<ActiveShare | null>(null);

  const onLiveStatus = useCallback((status: LiveSessionStatus) => {
    setLive(status);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetch(`/api/projects/${projectId}/shares`);
      if (!res.ok || cancelled) return;
      const json = (await res.json()) as {
        shares?: Array<{ id: string; url: string }>;
      };
      const latest = json.shares?.[0];
      if (latest && !cancelled) {
        setActiveShare({ id: latest.id, url: latest.url });
        setStrip({ kind: "share", url: latest.url, copied: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  function onShared(result: ShareResult) {
    setActiveShare({ id: result.id, url: result.url });
    setStrip({ kind: "share", url: result.url, copied: result.copied });
  }

  function onShareError(message: string) {
    if (!message) return;
    setStrip({ kind: "error", message });
  }

  async function copyAgain(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setStrip({ kind: "share", url, copied: true });
    } catch {
      setStrip({ kind: "share", url, copied: false });
    }
  }

  async function setShowEstimate(next: boolean) {
    setEstimateBusy(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/live-session`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ showEstimate: next }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setStrip({
          kind: "error",
          message: json.error || "Could not update estimate visibility",
        });
        return;
      }
      const json = (await res.json()) as {
        state?: { showEstimate?: boolean };
      };
      setLive((prev) =>
        prev
          ? { ...prev, showEstimate: Boolean(json.state?.showEstimate ?? next) }
          : prev,
      );
    } finally {
      setEstimateBusy(false);
    }
  }

  async function applyClientFinishes() {
    if (!live?.canApplyFinishes) return;
    setApplyBusy(true);
    try {
      onDesignChange(applyFinishesToDesign(design, live.finishes));
      onViewChange("design");
      ensure3d();
      await new Promise((r) => setTimeout(r, 800));
      const dataUrl = capturePreview();
      const appliedKey = liveFinishesKey(live.finishes);
      let previewImageUrl: string | undefined;
      if (dataUrl) {
        const up = await fetch(`/api/projects/${projectId}/preview`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dataUrl }),
        });
        if (up.ok) {
          const json = (await up.json()) as { url?: string };
          if (json.url) previewImageUrl = json.url;
        }
      }
      await fetch(`/api/projects/${projectId}/live-session`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appliedFinishesKey: appliedKey,
          ...(previewImageUrl ? { previewImageUrl } : {}),
        }),
      });
      setLive((prev) =>
        prev
          ? {
              ...prev,
              canApplyFinishes: false,
              pendingSummary: null,
              lastApproval: null,
              previewImageUrl: previewImageUrl ?? prev.previewImageUrl,
            }
          : prev,
      );
      if (activeShare) {
        setStrip({
          kind: "share",
          url: activeShare.url,
          copied: false,
          updated: true,
        });
      }
    } catch (e) {
      setStrip({
        kind: "error",
        message:
          e instanceof Error ? e.message : "Could not apply client finishes",
      });
    } finally {
      setApplyBusy(false);
    }
  }

  const showLiveStrip = Boolean(live?.active);
  const showShareStrip = strip?.kind === "share" || Boolean(activeShare);
  const showStrip =
    strip != null || showLiveStrip || Boolean(activeShare);

  const shareUrl =
    strip?.kind === "share" ? strip.url : activeShare?.url ?? null;

  return (
    <div className="panel project-toolbar">
      <div className="project-toolbar-row">
        <div className="project-toolbar-identity">
          <div className="muted project-toolbar-label">Project</div>
          <div className="project-toolbar-title">
            <strong>{projectName}</strong>
            <span className="badge">{DESIGN_LEVEL_LABELS[designLevel]}</span>
          </div>
        </div>

        <div className="project-toolbar-actions">
          <LiveSessionHostControls
            projectId={projectId}
            entitlements={entitlements}
            ensure3d={ensure3d}
            capturePreview={capturePreview}
            onStatusChange={onLiveStatus}
            onShareReady={(share) => {
              setActiveShare({ id: share.shareId, url: share.url });
              setStrip({ kind: "share", url: share.url, copied: false });
            }}
          />
          <label
            className="project-toolbar-check"
            title="Attach estimate to a new client link"
          >
            <input
              type="checkbox"
              checked={includeEstimate}
              onChange={(e) => setIncludeEstimate(e.target.checked)}
            />
            <span>Include estimate</span>
          </label>
          <ShareProposalButton
            projectId={projectId}
            ensure3d={ensure3d}
            capturePreview={capturePreview}
            includeEstimate={includeEstimate}
            onShared={onShared}
            onError={onShareError}
          />
          <span className="project-toolbar-divider" aria-hidden />
          <div
            className="project-toolbar-segment"
            role="group"
            aria-label="Workspace view"
          >
            <button
              type="button"
              className={`btn ${view === "design" ? "" : "secondary"}`}
              onClick={() => onViewChange("design")}
            >
              Design
            </button>
            <button
              type="button"
              className={`btn ${view === "estimate" ? "" : "secondary"}`}
              onClick={() => onViewChange("estimate")}
            >
              Estimate / BOM
            </button>
          </div>
        </div>
      </div>

      {showStrip ? (
        <div className="project-toolbar-strip">
          {showShareStrip && shareUrl ? (
            <>
              <span className="project-toolbar-strip-ok">
                {strip?.kind === "share" && strip.updated
                  ? "Still updated"
                  : strip?.kind === "share" && strip.copied
                    ? "Link copied"
                    : "Client link"}
              </span>
              <span className="project-toolbar-strip-url" title={shareUrl}>
                {truncateUrl(shareUrl)}
              </span>
              <button
                type="button"
                className="btn secondary project-toolbar-strip-btn"
                onClick={() => void copyAgain(shareUrl)}
              >
                Copy
              </button>
              <a
                className="btn secondary project-toolbar-strip-btn"
                href={shareUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open
              </a>
              {activeShare ? (
                <UpdateShareStillButton
                  projectId={projectId}
                  shareId={activeShare.id}
                  ensure3d={ensure3d}
                  capturePreview={capturePreview}
                  onUpdated={() =>
                    setStrip({
                      kind: "share",
                      url: activeShare.url,
                      copied: false,
                      updated: true,
                    })
                  }
                  onError={onShareError}
                />
              ) : null}
              {strip?.kind === "share" ? (
                <button
                  type="button"
                  className="btn ghost project-toolbar-strip-dismiss"
                  onClick={() => setStrip(null)}
                >
                  Dismiss
                </button>
              ) : null}
            </>
          ) : null}

          {strip?.kind === "error" ? (
            <>
              <span className="project-toolbar-strip-err">{strip.message}</span>
              <button
                type="button"
                className="btn ghost project-toolbar-strip-dismiss"
                onClick={() => setStrip(null)}
              >
                Dismiss
              </button>
            </>
          ) : null}

          {showLiveStrip && strip?.kind !== "error" ? (
            <>
              {showShareStrip ? (
                <span className="project-toolbar-strip-sep" aria-hidden />
              ) : null}
              <span className="project-toolbar-strip-live">
                Live
                {live?.guestConnected
                  ? " · guest connected"
                  : " · waiting for guest"}
                {live?.pendingSummary ? ` · ${live.pendingSummary}` : ""}
                {live?.lastApproval ? ` · ${live.lastApproval}` : ""}
              </span>
              <label className="project-toolbar-check project-toolbar-strip-check">
                <input
                  type="checkbox"
                  checked={Boolean(live?.showEstimate)}
                  disabled={estimateBusy}
                  onChange={(e) => void setShowEstimate(e.target.checked)}
                />
                <span>Show estimate to client</span>
              </label>
              {live?.canApplyFinishes ? (
                <button
                  type="button"
                  className="btn secondary project-toolbar-strip-btn"
                  disabled={applyBusy}
                  onClick={() => void applyClientFinishes()}
                >
                  {applyBusy ? "Applying…" : "Apply finishes"}
                </button>
              ) : null}
              {live?.error ? (
                <span className="project-toolbar-strip-err">{live.error}</span>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
