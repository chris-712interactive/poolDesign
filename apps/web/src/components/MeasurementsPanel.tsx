"use client";

import { useMemo, useState } from "react";
import {
  buildPlanMeasurements,
  formatPlanMeasurement,
  planMeasurementsPlainText,
  type DesignDocument,
  type UnitSystem,
} from "@pool-design/shared";

type Props = {
  projectId: string;
  design: DesignDocument;
  unitSystem: UnitSystem;
};

export function MeasurementsPanel({
  projectId,
  design,
  unitSystem,
}: Props) {
  const groups = useMemo(
    () => buildPlanMeasurements(design, unitSystem),
    [design, unitSystem],
  );
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  async function copyList() {
    const text = planMeasurementsPlainText(groups, unitSystem);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  async function openPdf() {
    setExportError(null);
    setExporting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/measurements`);
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        setExportError(json.error || "Could not open measurements PDF");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="panel measurements-panel stack">
      <div className="measurements-panel-head">
        <div>
          <h1>Measurements</h1>
          <p className="muted" style={{ margin: 0 }}>
            Lengths, perimeters, and areas from the current plan. Patio paving
            area is the deck minus pool and spa holes. This is a quantity list,
            not a priced estimate.
          </p>
        </div>
        {groups.length > 0 ? (
          <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn secondary"
              onClick={() => void copyList()}
            >
              {copied ? "Copied" : "Copy list"}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => void openPdf()}
              disabled={exporting}
              title="Open a printable sheet — Save as PDF from the browser"
            >
              {exporting ? "Opening…" : "Export PDF"}
            </button>
          </div>
        ) : null}
      </div>

      {exportError ? <p className="error">{exportError}</p> : null}

      {groups.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>
          Draw a pool, patio, plumbing run, or fence to see quantities here.
        </p>
      ) : (
        groups.map((group) => (
          <section key={group.id} className="measurements-group">
            <h2>{group.title}</h2>
            <table className="table measurements-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Quantity</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {group.rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.label}</td>
                    <td className="measurements-qty">
                      {formatPlanMeasurement(row, unitSystem)}
                    </td>
                    <td className="muted">{row.note ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))
      )}
    </div>
  );
}
