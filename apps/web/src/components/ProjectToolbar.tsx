"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type {
  DesignDocument,
  DesignLevel,
  DesignStatus,
  PlanEntitlements,
} from "@pool-design/shared";
import {
  DESIGN_LEVEL_LABELS,
  DESIGN_STATUS_LABELS,
  liveFinishesKey,
  parseDesignStatus,
  parseReviewKind,
  REVIEW_KIND_LABELS,
} from "@pool-design/shared";
import {
  LiveSessionHostControls,
  type LiveSessionStatus,
} from "@/components/LiveSessionHostControls";
import {
  ShareProposalButton,
  UpdateShareStillButton,
  type ShareResult,
} from "@/components/ShareProposalButton";

type WorkspaceView = "design" | "estimate" | "measurements";

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
  const [designStatus, setDesignStatus] = useState<DesignStatus>("in_design");
  const [requestApproval, setRequestApproval] = useState(false);
  const [approvalBusy, setApprovalBusy] = useState(false);
  const [latestReview, setLatestReview] = useState<{
    kind: string;
    createdAt: string;
  } | null>(null);

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

  useEffect(() => {
    let cancelled = false;
    async function loadReviews() {
      const res = await fetch(`/api/projects/${projectId}/reviews`);
      if (!res.ok || cancelled) return;
      const json = (await res.json()) as {
        designStatus?: unknown;
        requestClientApproval?: boolean;
        reviews?: Array<{ kind: string; createdAt: string }>;
      };
      if (cancelled) return;
      setDesignStatus(parseDesignStatus(json.designStatus));
      setRequestApproval(Boolean(json.requestClientApproval));
      const latest = json.reviews?.[0];
      setLatestReview(latest ?? null);
    }
    void loadReviews();
    const t = setInterval(() => void loadReviews(), 8000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [projectId]);

  async function setRequestClientApproval(next: boolean) {
    setApprovalBusy(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/reviews`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestClientApproval: next }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        designStatus?: unknown;
        requestClientApproval?: boolean;
      };
      if (!res.ok) {
        setStrip({
          kind: "error",
          message: json.error || "Could not update approval request",
        });
        return;
      }
      setRequestApproval(Boolean(json.requestClientApproval));
      if (json.designStatus) {
        setDesignStatus(parseDesignStatus(json.designStatus));
      }
    } finally {
      setApprovalBusy(false);
    }
  }

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
          <div className="project-toolbar-title">
            <strong>{projectName}</strong>
            <span className="badge">{DESIGN_LEVEL_LABELS[designLevel]}</span>
            <span
              className={`badge ${
                designStatus === "approved"
                  ? "ok"
                  : designStatus === "changes_requested"
                    ? "warn"
                    : designStatus === "awaiting_approval"
                      ? ""
                      : "muted"
              }`}
              title="Client design workflow"
            >
              {DESIGN_STATUS_LABELS[designStatus]}
            </span>
            <Link
              className="project-toolbar-details"
              href={`/app/projects/${projectId}/details`}
            >
              Details
            </Link>
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
            title="Show Approve on the client link for this revision"
          >
            <input
              type="checkbox"
              checked={requestApproval}
              disabled={approvalBusy}
              onChange={(e) => void setRequestClientApproval(e.target.checked)}
            />
            <span>Ask for approval</span>
          </label>
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
              data-tour="view-design"
              onClick={() => onViewChange("design")}
            >
              Design
            </button>
            <button
              type="button"
              className={`btn ${view === "measurements" ? "" : "secondary"}`}
              data-tour="view-measurements"
              onClick={() => onViewChange("measurements")}
            >
              Measurements
            </button>
            <button
              type="button"
              className={`btn ${view === "estimate" ? "" : "secondary"}`}
              data-tour="view-estimate"
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
              {latestReview ? (
                <span className="project-toolbar-strip-review">
                  {(() => {
                    const kind = parseReviewKind(latestReview.kind);
                    const label = kind
                      ? REVIEW_KIND_LABELS[kind]
                      : latestReview.kind;
                    const when = new Date(latestReview.createdAt);
                    return `${label} ${
                      Number.isNaN(when.getTime())
                        ? ""
                        : when.toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })
                    }`;
                  })()}
                </span>
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
