"use client";

import { useMemo, useState } from "react";
import {
  gradeWalkToSamples,
  mergeGradeWalkSamples,
  mmToFeet,
  type DesignDocument,
  type PlanEntitlements,
  type PointMm,
  type UnitSystem,
} from "@pool-design/shared";

type Props = {
  projectId: string;
  design: DesignDocument;
  unitSystem: UnitSystem;
  entitlements: PlanEntitlements;
  onDesignChange: (next: DesignDocument) => void;
  /** Optional default origin (e.g. last click / building centroid). */
  defaultOrigin?: PointMm | null;
};

type Row = { distance: string; drop: string };

function parseLengthToMm(raw: string, unitSystem: UnitSystem): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return unitSystem === "metric" ? n * 1000 : n * 304.8;
}

/**
 * Field grade-walk importer.
 * Phone AR companions POST the same payload to /grade-walk; this UI lets
 * designers capture or paste a transect (distance + drop) in-browser.
 */
export function GradeWalkPanel({
  projectId,
  design,
  unitSystem,
  entitlements,
  onDesignChange,
  defaultOrigin,
}: Props) {
  const [originX, setOriginX] = useState(() =>
    defaultOrigin ? String(mmToDisplay(defaultOrigin.x, unitSystem)) : "0",
  );
  const [originY, setOriginY] = useState(() =>
    defaultOrigin ? String(mmToDisplay(defaultOrigin.y, unitSystem)) : "0",
  );
  const [bearing, setBearing] = useState("90");
  const [rows, setRows] = useState<Row[]>([
    { distance: "0", drop: "0" },
    { distance: unitSystem === "metric" ? "3" : "10", drop: unitSystem === "metric" ? "0.15" : "0.5" },
    { distance: unitSystem === "metric" ? "9" : "30", drop: unitSystem === "metric" ? "0.45" : "1.5" },
  ]);
  const [replaceExisting, setReplaceExisting] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const lengthLabel = unitSystem === "metric" ? "m" : "ft";

  const previewCount = useMemo(() => {
    const points = rows
      .map((r) => {
        const distanceMm = parseLengthToMm(r.distance, unitSystem);
        const dropMm = parseLengthToMm(r.drop, unitSystem);
        if (distanceMm == null || dropMm == null) return null;
        return { distanceMm, dropMm };
      })
      .filter(Boolean);
    return points.length;
  }, [rows, unitSystem]);

  if (!entitlements.arGradeImport) {
    return (
      <div className="stack" style={{ gap: "0.35rem" }}>
        <strong>Grade walk import</strong>
        <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
          Builder plan required to import phone / AR grade walks.
        </p>
      </div>
    );
  }

  async function applyLocal() {
    setError(null);
    setMessage(null);
    const ox = parseLengthToMm(originX, unitSystem);
    const oy = parseLengthToMm(originY, unitSystem);
    const bearingDeg = Number(bearing);
    if (ox == null || oy == null || !Number.isFinite(bearingDeg)) {
      setError("Enter a valid origin and bearing.");
      return;
    }
    const points = [];
    for (const r of rows) {
      const distanceMm = parseLengthToMm(r.distance, unitSystem);
      const dropMm = parseLengthToMm(r.drop, unitSystem);
      if (distanceMm == null || dropMm == null) {
        setError("Each row needs distance and drop/rise.");
        return;
      }
      points.push({ distanceMm, dropMm });
    }
    const imported = gradeWalkToSamples({
      origin: { x: ox, y: oy },
      bearingDeg,
      points,
    });
    onDesignChange({
      ...design,
      gradeSamples: mergeGradeWalkSamples({
        existing: design.gradeSamples ?? [],
        imported,
        replaceExisting,
      }),
    });
    setMessage(`Imported ${imported.length} grade samples into the design.`);
  }

  async function applyViaApi() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const ox = parseLengthToMm(originX, unitSystem);
      const oy = parseLengthToMm(originY, unitSystem);
      const bearingDeg = Number(bearing);
      if (ox == null || oy == null || !Number.isFinite(bearingDeg)) {
        throw new Error("Enter a valid origin and bearing.");
      }
      const points = rows.map((r) => {
        const distanceMm = parseLengthToMm(r.distance, unitSystem)!;
        const dropMm = parseLengthToMm(r.drop, unitSystem)!;
        return { distanceMm, dropMm };
      });
      const res = await fetch(`/api/projects/${projectId}/grade-walk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: { x: ox, y: oy },
          bearingDeg,
          points,
          replaceExisting,
          apply: true,
        }),
      });
      const json = (await res.json()) as {
        error?: string;
        samples?: unknown[];
      };
      if (!res.ok) throw new Error(json.error || "Import failed");
      // Keep local CAD in sync with server merge
      await applyLocal();
      setMessage(
        `Saved ${json.samples?.length ?? 0} grade samples (AR walk API).`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack" style={{ gap: "0.5rem" }}>
      <strong>Grade walk capture</strong>
      <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
        Start at the house (FFE), walk outward, record distance and elevation
        drop. Phone AR apps can POST the same payload to the grade-walk API.
      </p>
      <div className="row" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
        <div className="field" style={{ flex: "1 1 5rem" }}>
          <label>Origin X ({lengthLabel})</label>
          <input value={originX} onChange={(e) => setOriginX(e.target.value)} />
        </div>
        <div className="field" style={{ flex: "1 1 5rem" }}>
          <label>Origin Y ({lengthLabel})</label>
          <input value={originY} onChange={(e) => setOriginY(e.target.value)} />
        </div>
        <div className="field" style={{ flex: "1 1 5rem" }}>
          <label>Bearing °</label>
          <input value={bearing} onChange={(e) => setBearing(e.target.value)} />
        </div>
      </div>
      {rows.map((row, i) => (
        <div key={i} className="row" style={{ gap: "0.5rem" }}>
          <div className="field" style={{ flex: 1 }}>
            <label>
              Dist {lengthLabel} #{i + 1}
            </label>
            <input
              value={row.distance}
              onChange={(e) => {
                const next = [...rows];
                next[i] = { ...row, distance: e.target.value };
                setRows(next);
              }}
            />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Drop {lengthLabel}</label>
            <input
              value={row.drop}
              onChange={(e) => {
                const next = [...rows];
                next[i] = { ...row, drop: e.target.value };
                setRows(next);
              }}
            />
          </div>
        </div>
      ))}
      <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
        <button
          type="button"
          className="btn secondary"
          onClick={() => setRows([...rows, { distance: "", drop: "" }])}
        >
          Add sample
        </button>
        <label className="row" style={{ gap: "0.35rem", fontSize: "0.85rem" }}>
          <input
            type="checkbox"
            checked={replaceExisting}
            onChange={(e) => setReplaceExisting(e.target.checked)}
          />
          Replace prior AR walk samples
        </label>
      </div>
      <div className="row" style={{ gap: "0.5rem" }}>
        <button type="button" className="btn" disabled={busy} onClick={() => void applyLocal()}>
          Import into design ({previewCount})
        </button>
        <button
          type="button"
          className="btn secondary"
          disabled={busy}
          onClick={() => void applyViaApi()}
        >
          Save via API
        </button>
      </div>
      {message ? <p className="muted" style={{ margin: 0 }}>{message}</p> : null}
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}

function mmToDisplay(mm: number, unitSystem: UnitSystem): number {
  if (unitSystem === "metric") return Math.round((mm / 1000) * 1000) / 1000;
  return Math.round(mmToFeet(mm) * 100) / 100;
}
