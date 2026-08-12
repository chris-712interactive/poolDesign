"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  PATIO_FINISHES,
  WATERLINE_TILES,
  type LiveSessionState,
} from "@pool-design/shared";

type Props = { token: string };

export function ClientLiveSessionPanel({ token }: Props) {
  const [state, setState] = useState<LiveSessionState | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/p/${token}/live`);
    if (!res.ok) return;
    const json = (await res.json()) as {
      active: boolean;
      state: LiveSessionState;
    };
    setActive(json.active);
    setState(json.state);
  }, [token]);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 2500);
    return () => clearInterval(t);
  }, [refresh]);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  const tileOptions = useMemo(
    () => WATERLINE_TILES.slice(0, 24),
    [],
  );
  const patioOptions = useMemo(() => PATIO_FINISHES.slice(0, 16), []);

  if (!active) {
    return (
      <section className="proposal-panel">
        <h2>Live design session</h2>
        <p className="muted">
          When your designer starts a live session, you can swap finishes and
          approve options here in real time.
        </p>
      </section>
    );
  }

  return (
    <section className="proposal-panel stack">
      <h2>Live design session</h2>
      <p className="muted">
        Connected — changes appear for your designer immediately.
      </p>

      <div className="field">
        <label htmlFor="live-tile">Waterline tile</label>
        <select
          id="live-tile"
          disabled={busy}
          value={state?.finishes.waterlineTileId ?? ""}
          onChange={(e) => {
            const waterlineTileId = e.target.value || undefined;
            void patch({ finishes: { waterlineTileId } });
          }}
        >
          <option value="">Keep current</option>
          {tileOptions.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="live-patio">Patio finish (all patios)</label>
        <select
          id="live-patio"
          disabled={busy}
          value=""
          onChange={(e) => {
            const id = e.target.value;
            if (!id) return;
            // Guest applies a global patio preference via a synthetic key;
            // host applies to all patios when accepting finishes.
            void patch({
              finishes: { patioMaterialById: { "*": id } },
            });
          }}
        >
          <option value="">Choose a finish…</option>
          {patioOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
        <button
          type="button"
          className="btn"
          disabled={busy}
          onClick={() =>
            void patch({
              approval: { label: "Design direction", status: "approved" },
            })
          }
        >
          Approve design
        </button>
        <button
          type="button"
          className="btn secondary"
          disabled={busy}
          onClick={() =>
            void patch({
              approval: { label: "Design direction", status: "rejected" },
            })
          }
        >
          Request changes
        </button>
      </div>

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
