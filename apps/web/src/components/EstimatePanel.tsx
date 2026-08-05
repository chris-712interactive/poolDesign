"use client";

import { useMemo, useState } from "react";
import {
  buildTakeoff,
  formatMoney,
  formatQuantity,
  type DesignDocument,
  type UnitSystem,
} from "@pool-design/shared";

type Props = {
  projectId: string;
  design: DesignDocument;
  unitSystem: UnitSystem;
};

export function EstimatePanel({ projectId, design, unitSystem }: Props) {
  const takeoff = useMemo(
    () => buildTakeoff(design, unitSystem),
    [design, unitSystem],
  );
  const [milestoneState, setMilestoneState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  async function markEstimateGenerated() {
    setMilestoneState("saving");
    try {
      const res = await fetch(`/api/projects/${projectId}/estimate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ takeoff }),
      });
      if (!res.ok) throw new Error("failed");
      setMilestoneState("saved");
    } catch {
      setMilestoneState("error");
    }
  }

  const empty =
    design.poolBodies.length === 0 &&
    design.patios.length === 0 &&
    design.plumbingRuns.length === 0;

  return (
    <div className="panel stack" style={{ minHeight: 520 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <h2 style={{ margin: 0 }}>Material list & estimate</h2>
          <p className="muted" style={{ margin: "0.35rem 0 0" }}>
            Quantities update from the current design (pool, patio, plumbing).
          </p>
        </div>
        <button
          type="button"
          className="btn"
          onClick={markEstimateGenerated}
          disabled={empty || milestoneState === "saving"}
        >
          {milestoneState === "saved"
            ? "Estimate recorded"
            : milestoneState === "saving"
              ? "Saving…"
              : "Record estimate"}
        </button>
      </div>

      {empty ? (
        <p className="muted">
          Draw a pool, patio, or plumbing run in Design view to generate takeoffs.
        </p>
      ) : (
        <>
          <table className="table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Category</th>
                <th>Qty</th>
                <th>Unit price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {takeoff.lines.map((line) => (
                <tr key={line.catalogItemId}>
                  <td>
                    <strong>{line.name}</strong>
                    {line.note && (
                      <div className="muted" style={{ fontSize: "0.85rem" }}>
                        {line.note}
                      </div>
                    )}
                  </td>
                  <td style={{ textTransform: "capitalize" }}>{line.category}</td>
                  <td>{formatQuantity(line.quantity, line.unit)}</td>
                  <td>{formatMoney(line.unitPriceCents)}</td>
                  <td>{formatMoney(line.totalCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <strong style={{ fontSize: "1.2rem" }}>
              Subtotal {formatMoney(takeoff.subtotalCents)}
            </strong>
          </div>
          {milestoneState === "error" && (
            <p className="error">Could not record estimate milestone.</p>
          )}
        </>
      )}
    </div>
  );
}
