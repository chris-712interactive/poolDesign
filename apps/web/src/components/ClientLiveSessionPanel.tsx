"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_PATIO_FINISH_ID,
  DEFAULT_WATERLINE_TILE_ID,
  getPatioFinish,
  getWaterlineTile,
  patioFinishCssColor,
  waterlineTileCssColor,
  type LiveSessionState,
} from "@pool-design/shared";
import { PatioFinishPicker } from "@/components/PatioFinishPicker";
import { WaterlineTilePicker } from "@/components/WaterlineTilePicker";

type Props = { token: string };

type Draft = {
  waterlineTileId: string;
  patioMaterialId: string;
};

/**
 * Client live session: browse finishes like the designer (pattern + color),
 * preview the combination locally, then send to the designer.
 */
export function ClientLiveSessionPanel({ token }: Props) {
  const [state, setState] = useState<LiveSessionState | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentOk, setSentOk] = useState(false);
  const [draft, setDraft] = useState<Draft>({
    waterlineTileId: DEFAULT_WATERLINE_TILE_ID,
    patioMaterialId: DEFAULT_PATIO_FINISH_ID,
  });
  const [seeded, setSeeded] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/p/${token}/live`);
    if (!res.ok) return;
    const json = (await res.json()) as {
      active: boolean;
      state: LiveSessionState;
    };
    setActive(json.active);
    setState(json.state);
    if (!seeded && json.state) {
      const patioId =
        json.state.finishes.patioMaterialById?.["*"] ??
        Object.values(json.state.finishes.patioMaterialById ?? {})[0];
      setDraft({
        waterlineTileId:
          json.state.finishes.waterlineTileId ?? DEFAULT_WATERLINE_TILE_ID,
        patioMaterialId: patioId ?? DEFAULT_PATIO_FINISH_ID,
      });
      setSeeded(true);
    }
  }, [token, seeded]);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 2500);
    return () => clearInterval(t);
  }, [refresh]);

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
        active?: boolean;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || "Update failed");
      if (json.state) setState(json.state);
      if (typeof json.active === "boolean") setActive(json.active);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const tile = useMemo(
    () => getWaterlineTile(draft.waterlineTileId),
    [draft.waterlineTileId],
  );
  const patio = useMemo(
    () => getPatioFinish(draft.patioMaterialId),
    [draft.patioMaterialId],
  );

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

  if (!active) {
    return (
      <section className="proposal-panel">
        <h2>Live design session</h2>
        <p className="muted">
          When your designer starts a live session, you can preview tile and
          patio finishes here before sharing picks with them.
        </p>
      </section>
    );
  }

  return (
    <section className="proposal-panel stack client-live-panel">
      <div>
        <h2 style={{ marginBottom: "0.35rem" }}>Live finish preview</h2>
        <p className="muted" style={{ margin: 0 }}>
          Browse patterns and colors like your designer. Preview the combination
          below, then send it when you&apos;re ready — nothing changes for them
          until you send.
        </p>
      </div>

      <div className="client-finish-preview" aria-live="polite">
        <div className="client-finish-preview-stage">
          <div
            className="client-finish-preview-patio"
            style={{
              background: `linear-gradient(135deg, ${patioFinishCssColor(patio.color)} 55%, ${patioFinishCssColor(patio.accent)} 55%)`,
            }}
          />
          <div className="client-finish-preview-pool">
            <div
              className="client-finish-preview-waterline"
              style={{
                background: `linear-gradient(90deg, ${waterlineTileCssColor(tile.color)}, ${waterlineTileCssColor(tile.blend?.[0] ?? tile.accent)})`,
              }}
            />
            <div className="client-finish-preview-water" />
          </div>
        </div>
        <div className="client-finish-preview-meta">
          <div>
            <span className="muted">Waterline</span>
            <strong>{tile.name}</strong>
          </div>
          <div>
            <span className="muted">Patio</span>
            <strong>{patio.name}</strong>
          </div>
        </div>
      </div>

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

      <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
        <button
          type="button"
          className="btn"
          disabled={busy || !dirty}
          onClick={() => void sendToDesigner()}
        >
          {busy ? "Sending…" : sentOk ? "Sent to designer" : "Send to designer"}
        </button>
        <button
          type="button"
          className="btn secondary"
          disabled={busy}
          onClick={() =>
            void patch({
              approval: { label: "Finish direction", status: "approved" },
            })
          }
        >
          Approve finishes
        </button>
        <button
          type="button"
          className="btn secondary"
          disabled={busy}
          onClick={() =>
            void patch({
              approval: { label: "Finish direction", status: "rejected" },
            })
          }
        >
          Request changes
        </button>
      </div>

      {dirty && !sentOk ? (
        <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
          You have unsaved preview picks — tap Send to designer when ready.
        </p>
      ) : null}

      {state?.approvals?.length ? (
        <ul className="muted" style={{ margin: 0, paddingLeft: "1.1rem" }}>
          {state.approvals.slice(-5).map((a) => (
            <li key={a.id}>
              {a.label}: {a.status} ({a.by})
            </li>
          ))}
        </ul>
      ) : null}
      {error ? <p style={{ color: "var(--danger)" }}>{error}</p> : null}
    </section>
  );
}
