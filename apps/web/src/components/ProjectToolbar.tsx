"use client";

import { useCallback, useState } from "react";
import type {
  DesignDocument,
  DesignLevel,
  PlanEntitlements,
} from "@pool-design/shared";
import { DESIGN_LEVEL_LABELS } from "@pool-design/shared";
import {
  LiveSessionHostControls,
  type LiveSessionStatus,
} from "@/components/LiveSessionHostControls";
import {
  ShareProposalButton,
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

type StripState =
  | { kind: "share"; url: string; copied: boolean }
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
  return {
    ...design,
    poolBodies: design.poolBodies.map((b) =>
      finishes.waterlineTileId
        ? { ...b, waterlineTileId: finishes.waterlineTileId }
        : b,
    ),
    patios: design.patios.map((p) => {
      const all = finishes.patioMaterialById?.["*"];
      const one = finishes.patioMaterialById?.[p.id];
      const materialId = one ?? all;
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

  const onLiveStatus = useCallback((status: LiveSessionStatus) => {
    setLive(status);
  }, []);

  function onShared(result: ShareResult) {
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

  const showLiveStrip = Boolean(live?.active);
  const showStrip = strip != null || showLiveStrip;

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
            onStatusChange={onLiveStatus}
          />
          <label className="project-toolbar-check" title="Attach estimate to the client link">
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
          {strip?.kind === "share" ? (
            <>
              <span className="project-toolbar-strip-ok">
                {strip.copied ? "Link copied" : "Link ready"}
              </span>
              <span className="project-toolbar-strip-url" title={strip.url}>
                {truncateUrl(strip.url)}
              </span>
              <button
                type="button"
                className="btn secondary project-toolbar-strip-btn"
                onClick={() => void copyAgain(strip.url)}
              >
                Copy
              </button>
              <a
                className="btn secondary project-toolbar-strip-btn"
                href={strip.url}
                target="_blank"
                rel="noreferrer"
              >
                Open
              </a>
              <button
                type="button"
                className="btn ghost project-toolbar-strip-dismiss"
                onClick={() => setStrip(null)}
              >
                Dismiss
              </button>
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
              {strip?.kind === "share" ? (
                <span className="project-toolbar-strip-sep" aria-hidden />
              ) : null}
              <span className="project-toolbar-strip-live">
                Live
                {live?.guestConnected
                  ? " · guest connected"
                  : " · waiting for guest"}
                {live?.tileName ? ` · ${live.tileName}` : ""}
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
                  onClick={() =>
                    onDesignChange(applyFinishesToDesign(design, live.finishes))
                  }
                >
                  Apply finishes
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
