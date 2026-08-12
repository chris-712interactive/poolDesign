"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_PATIO_FINISH_ID,
  DEFAULT_WATERLINE_TILE_ID,
  type LiveSessionState,
  type TakeoffResult,
} from "@pool-design/shared";
import { PatioFinishPicker } from "@/components/PatioFinishPicker";
import { WaterlineTilePicker } from "@/components/WaterlineTilePicker";
import { FinishCombinationPreview } from "@/components/FinishCombinationPreview";
import { ProposalEstimateSection } from "@/components/ProposalEstimateSection";

type LiveTab = "finishes" | "estimate";

type Props = {
  token: string;
  projectName: string;
  state: LiveSessionState | null;
  previewImageUrl: string | null;
  showEstimate: boolean;
  estimate: TakeoffResult | null;
  onPatched: (state: LiveSessionState) => void;
};

type Draft = {
  waterlineTileId: string;
  patioMaterialId: string;
};

/**
 * Live session: one 3D still beside finish pickers (no duplicate preview).
 */
export function ClientLiveSessionPanel({
  token,
  projectName,
  state,
  previewImageUrl,
  showEstimate,
  estimate,
  onPatched,
}: Props) {
  const [tab, setTab] = useState<LiveTab>("finishes");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentOk, setSentOk] = useState(false);
  const [draft, setDraft] = useState<Draft>({
    waterlineTileId: DEFAULT_WATERLINE_TILE_ID,
    patioMaterialId: DEFAULT_PATIO_FINISH_ID,
  });
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (!showEstimate && tab === "estimate") setTab("finishes");
  }, [showEstimate, tab]);

  useEffect(() => {
    if (seeded || !state) return;
    const patioId =
      state.finishes.patioMaterialById?.["*"] ??
      Object.values(state.finishes.patioMaterialById ?? {})[0];
    setDraft({
      waterlineTileId:
        state.finishes.waterlineTileId ?? DEFAULT_WATERLINE_TILE_ID,
      patioMaterialId: patioId ?? DEFAULT_PATIO_FINISH_ID,
    });
    setSeeded(true);
  }, [state, seeded]);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    setSentOk(false);
    try {
      const res = await fetch(`/api/p/${token}/live`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as {
        state?: LiveSessionState;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || "Update failed");
      if (json.state) onPatched(json.state);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const dirty = useMemo(() => {
    const sentTile = state?.finishes.waterlineTileId;
    const sentPatio =
      state?.finishes.patioMaterialById?.["*"] ??
      Object.values(state?.finishes.patioMaterialById ?? {})[0];
    return (
      draft.waterlineTileId !== sentTile ||
      draft.patioMaterialId !== sentPatio
    );
  }, [draft, state]);

  async function sendToDesigner() {
    const ok = await patch({
      finishes: {
        waterlineTileId: draft.waterlineTileId,
        patioMaterialById: { "*": draft.patioMaterialId },
      },
    });
    if (ok) setSentOk(true);
  }

  return (
    <section className="proposal-panel client-live-panel">
      <div className="client-live-split">
        <div className="client-live-still-pane">
          {previewImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={previewImageUrl}
              src={previewImageUrl}
              alt={`3D preview of ${projectName}`}
              className="client-live-still-img"
            />
          ) : (
            <div className="client-live-still-empty muted">
              Waiting for a 3D still from your designer…
            </div>
          )}
        </div>

        <div className="client-live-choices">
          {showEstimate ? (
            <div className="client-live-tabs" role="tablist" aria-label="Live session">
              <button
                type="button"
                role="tab"
                id="live-tab-finishes"
                aria-controls="live-panel-finishes"
                aria-selected={tab === "finishes"}
                className={`client-live-tab${tab === "finishes" ? " is-active" : ""}`}
                onClick={() => setTab("finishes")}
              >
                Finishes
              </button>
              <button
                type="button"
                role="tab"
                id="live-tab-estimate"
                aria-controls="live-panel-estimate"
                aria-selected={tab === "estimate"}
                className={`client-live-tab${tab === "estimate" ? " is-active" : ""}`}
                onClick={() => setTab("estimate")}
              >
                Estimate
              </button>
            </div>
          ) : (
            <div className="client-live-choices-head">
              <div>
                <h2>Your finishes</h2>
                <p className="muted">
                  Browse tile and patio. Send when you&apos;re ready — nothing
                  changes for your designer until then.
                </p>
              </div>
              <span className="badge">Live</span>
            </div>
          )}

          {tab === "estimate" && showEstimate ? (
            <div
              id="live-panel-estimate"
              role="tabpanel"
              aria-labelledby="live-tab-estimate"
              className="client-live-tabpanel"
            >
              <ProposalEstimateSection estimate={estimate} embedded />
            </div>
          ) : (
            <div
              id="live-panel-finishes"
              role="tabpanel"
              aria-labelledby={showEstimate ? "live-tab-finishes" : undefined}
              className="client-live-tabpanel"
            >
              {!showEstimate ? null : (
                <p className="muted" style={{ margin: 0, fontSize: "0.82rem" }}>
                  Browse tile and patio. Send when you&apos;re ready — nothing
                  changes for your designer until then.
                </p>
              )}

              <FinishCombinationPreview
                compact
                waterlineTileId={draft.waterlineTileId}
                patioMaterialId={draft.patioMaterialId}
              />

              <div className="client-finish-pickers">
                <div className="client-finish-block">
                  <h3>Waterline tile</h3>
                  <WaterlineTilePicker
                    value={draft.waterlineTileId}
                    hideEstimateNote
                    onChange={(waterlineTileId) => {
                      setSentOk(false);
                      setDraft((d) => ({ ...d, waterlineTileId }));
                    }}
                  />
                </div>
                <div className="client-finish-block">
                  <h3>Patio finish</h3>
                  <PatioFinishPicker
                    value={draft.patioMaterialId}
                    onChange={(patioMaterialId) => {
                      setSentOk(false);
                      setDraft((d) => ({ ...d, patioMaterialId }));
                    }}
                  />
                </div>
              </div>

              <div className="client-live-actions">
                <button
                  type="button"
                  className="btn"
                  disabled={busy || !dirty}
                  onClick={() => void sendToDesigner()}
                >
                  {busy
                    ? "Sending…"
                    : sentOk
                      ? "Sent to designer"
                      : "Send to designer"}
                </button>
                <button
                  type="button"
                  className="btn secondary"
                  disabled={busy}
                  onClick={() =>
                    void patch({
                      approval: {
                        label: "Finish direction",
                        status: "approved",
                      },
                    })
                  }
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="btn secondary"
                  disabled={busy}
                  onClick={() =>
                    void patch({
                      approval: {
                        label: "Finish direction",
                        status: "rejected",
                      },
                    })
                  }
                >
                  Request changes
                </button>
              </div>

              {dirty && !sentOk ? (
                <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
                  Unsent picks — tap Send to designer when ready.
                </p>
              ) : null}

              {state?.approvals?.length ? (
                <ul
                  className="muted"
                  style={{ margin: 0, paddingLeft: "1.1rem" }}
                >
                  {state.approvals.slice(-5).map((a) => (
                    <li key={a.id}>
                      {a.label}: {a.status} ({a.by})
                    </li>
                  ))}
                </ul>
              ) : null}
              {error ? <p style={{ color: "var(--danger)" }}>{error}</p> : null}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
