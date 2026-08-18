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
  design: DesignDocument;
  unitSystem: UnitSystem;
};

export function MeasurementsPanel({ design, unitSystem }: Props) {
  const groups = useMemo(
    () => buildPlanMeasurements(design, unitSystem),
    [design, unitSystem],
  );
  const [copied, setCopied] = useState(false);

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
          <button type="button" className="btn secondary" onClick={() => void copyList()}>
            {copied ? "Copied" : "Copy list"}
          </button>
        ) : null}
      </div>

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
