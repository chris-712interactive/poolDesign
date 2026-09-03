"use client";

import { useMemo, useState } from "react";
import {
  buildTakeoff,
  formatMoney,
  formatQuantity,
  type CatalogCategory,
  type CatalogItem,
  type CatalogUnit,
  type DesignDocument,
  type EstimateCustomLine,
  type EstimateRecipe,
  type PlanEntitlements,
  type UnitSystem,
} from "@pool-design/shared";

type Props = {
  projectId: string;
  design: DesignDocument;
  unitSystem: UnitSystem;
  onDesignChange: (next: DesignDocument) => void;
  /** Optional company price-book catalog */
  catalog?: CatalogItem[];
  estimateRecipe?: EstimateRecipe | null;
  entitlements?: PlanEntitlements;
};

const ADD_CATEGORIES: Array<CatalogCategory | "other"> = [
  "structure",
  "finish",
  "hardscape",
  "plumbing",
  "equipment",
  "labor",
  "other",
];

const ADD_UNITS: CatalogUnit[] = [
  "ea",
  "lf",
  "sf",
  "sy",
  "cy",
  "hr",
  "lb",
  "kg",
  "m",
  "m2",
  "m3",
];

function newCustomId(): string {
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function patchEstimate(
  design: DesignDocument,
  patch: Partial<NonNullable<DesignDocument["estimate"]>>,
): DesignDocument {
  return {
    ...design,
    estimate: {
      removedLineKeys: design.estimate?.removedLineKeys ?? [],
      customLines: design.estimate?.customLines ?? [],
      ...patch,
    },
  };
}

export function EstimatePanel({
  projectId,
  design,
  unitSystem,
  onDesignChange,
  catalog,
  estimateRecipe,
  entitlements,
}: Props) {
  const takeoff = useMemo(
    () => buildTakeoff(design, unitSystem, catalog, estimateRecipe),
    [design, unitSystem, catalog, estimateRecipe],
  );
  const [milestoneState, setMilestoneState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState("");
  const [addCategory, setAddCategory] = useState<CatalogCategory | "other">(
    "other",
  );
  const [addUnit, setAddUnit] = useState<CatalogUnit>("ea");
  const [addQty, setAddQty] = useState("1");
  const [addPrice, setAddPrice] = useState("");
  const [addNote, setAddNote] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const hasAutoScope =
    design.poolBodies.length > 0 ||
    design.patios.length > 0 ||
    design.plumbingRuns.length > 0 ||
    (design.patioCovers?.length ?? 0) > 0 ||
    (design.features?.length ?? 0) > 0;
  const hasLines = takeoff.lines.length > 0;

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

  async function openExport(path: string, gated: boolean | undefined) {
    setExportError(null);
    if (gated === false) {
      setExportError(
        "Upgrade to the Builder plan to export quotes and takeoffs.",
      );
      return;
    }
    const res = await fetch(path);
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      setExportError(json.error || "Export failed");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const disposition = res.headers.get("Content-Disposition") || "";
    const isCsv = path.includes("takeoff-csv");
    if (isCsv) {
      const a = document.createElement("a");
      a.href = url;
      a.download = disposition.includes("filename=")
        ? disposition.split("filename=")[1]?.replace(/"/g, "") || "takeoff.csv"
        : "takeoff.csv";
      a.click();
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  function removeLine(lineKey: string, custom?: boolean) {
    if (custom) {
      const id = lineKey.replace(/^custom:/, "");
      onDesignChange(
        patchEstimate(design, {
          customLines: (design.estimate?.customLines ?? []).filter(
            (l) => l.id !== id,
          ),
        }),
      );
      return;
    }
    const removed = new Set(design.estimate?.removedLineKeys ?? []);
    removed.add(lineKey);
    onDesignChange(patchEstimate(design, { removedLineKeys: [...removed] }));
  }

  function restoreLine(lineKey: string) {
    onDesignChange(
      patchEstimate(design, {
        removedLineKeys: (design.estimate?.removedLineKeys ?? []).filter(
          (k) => k !== lineKey,
        ),
      }),
    );
  }

  function addCustomLine() {
    setAddError(null);
    const name = addName.trim();
    if (!name) {
      setAddError("Name is required.");
      return;
    }
    const quantity = Number(addQty);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setAddError("Quantity must be greater than zero.");
      return;
    }
    const dollars = Number(addPrice);
    if (!Number.isFinite(dollars) || dollars < 0) {
      setAddError("Enter a valid unit price (USD).");
      return;
    }
    const line: EstimateCustomLine = {
      id: newCustomId(),
      name,
      category: addCategory,
      unit: addUnit,
      quantity,
      unitPriceCents: Math.round(dollars * 100),
      note: addNote.trim() || undefined,
    };
    onDesignChange(
      patchEstimate(design, {
        customLines: [...(design.estimate?.customLines ?? []), line],
      }),
    );
    setAddName("");
    setAddQty("1");
    setAddPrice("");
    setAddNote("");
    setShowAdd(false);
  }

  return (
    <div className="panel stack" style={{ minHeight: 520 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <h2 style={{ margin: 0 }}>Material list & estimate</h2>
          <p className="muted" style={{ margin: "0.35rem 0 0" }}>
            Construction takeoff from the design
            {estimateRecipe
              ? " using your company estimate recipe"
              : ""}
            . Furniture is layout-only and not billed. Remove or add lines as
            needed. PDF quote opens in a new tab — Print → Save as PDF for a
            letter-sized file.
          </p>
        </div>
        <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn secondary"
            disabled={!hasLines}
            onClick={() =>
              void openExport(
                `/api/projects/${projectId}/quote`,
                entitlements?.pdfQuote,
              )
            }
            title="Opens in a new tab. Print → Save as PDF."
          >
            PDF quote
          </button>
          <button
            type="button"
            className="btn secondary"
            disabled={!hasLines}
            onClick={() =>
              void openExport(
                `/api/projects/${projectId}/takeoff-csv`,
                entitlements?.csvTakeoff,
              )
            }
          >
            CSV export
          </button>
          <button
            type="button"
            className="btn secondary"
            onClick={() =>
              void openExport(
                `/api/projects/${projectId}/permit-packet`,
                entitlements?.permitPacket,
              )
            }
            title="Draft permit packet — not PE stamped"
          >
            Permit draft
          </button>
          <button
            type="button"
            className="btn secondary"
            onClick={() => {
              setShowAdd((v) => !v);
              setAddError(null);
            }}
          >
            {showAdd ? "Cancel" : "Add line item"}
          </button>
          <button
            type="button"
            className="btn"
            onClick={markEstimateGenerated}
            disabled={!hasLines || milestoneState === "saving"}
          >
            {milestoneState === "saved"
              ? "Estimate recorded"
              : milestoneState === "saving"
                ? "Saving…"
                : "Record estimate"}
          </button>
        </div>
      </div>

      {exportError ? <p className="error">{exportError}</p> : null}

      {showAdd && (
        <div
          className="stack"
          style={{
            padding: "0.85rem 1rem",
            border: "1px solid var(--line)",
            borderRadius: 12,
            background: "rgba(255,255,255,0.65)",
          }}
        >
          <strong>Add line item</strong>
          <div
            className="row"
            style={{ flexWrap: "wrap", gap: "0.75rem", alignItems: "end" }}
          >
            <div className="field" style={{ flex: "1 1 12rem" }}>
              <label htmlFor="est-name">Name</label>
              <input
                id="est-name"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="e.g. Permits & fees"
              />
            </div>
            <div className="field" style={{ flex: "0 1 8rem" }}>
              <label htmlFor="est-cat">Category</label>
              <select
                id="est-cat"
                value={addCategory}
                onChange={(e) =>
                  setAddCategory(e.target.value as CatalogCategory | "other")
                }
              >
                {ADD_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ flex: "0 1 6rem" }}>
              <label htmlFor="est-qty">Qty</label>
              <input
                id="est-qty"
                value={addQty}
                onChange={(e) => setAddQty(e.target.value)}
              />
            </div>
            <div className="field" style={{ flex: "0 1 6rem" }}>
              <label htmlFor="est-unit">Unit</label>
              <select
                id="est-unit"
                value={addUnit}
                onChange={(e) => setAddUnit(e.target.value as CatalogUnit)}
              >
                {ADD_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ flex: "0 1 8rem" }}>
              <label htmlFor="est-price">Unit price ($)</label>
              <input
                id="est-price"
                value={addPrice}
                onChange={(e) => setAddPrice(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="field" style={{ flex: "1 1 10rem" }}>
              <label htmlFor="est-note">Note (optional)</label>
              <input
                id="est-note"
                value={addNote}
                onChange={(e) => setAddNote(e.target.value)}
              />
            </div>
            <button type="button" className="btn" onClick={addCustomLine}>
              Add
            </button>
          </div>
          {addError && <p className="error">{addError}</p>}
        </div>
      )}

      {!hasAutoScope && !hasLines ? (
        <p className="muted">
          Draw a pool, patio, spa, cover, or plumbing run in Design view to
          generate takeoffs — or add a custom line item above.
        </p>
      ) : !hasLines && takeoff.removedLines.length === 0 ? (
        <p className="muted">No billable line items yet.</p>
      ) : (
        <>
          {hasLines && (
            <>
              <table className="table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Category</th>
                    <th>Qty</th>
                    <th>Unit price</th>
                    <th>Total</th>
                    <th style={{ width: "5.5rem" }} />
                  </tr>
                </thead>
                <tbody>
                  {takeoff.lines.map((line) => (
                    <tr key={line.lineKey}>
                      <td>
                        <strong>{line.name}</strong>
                        {line.note && (
                          <div className="muted" style={{ fontSize: "0.85rem" }}>
                            {line.note}
                          </div>
                        )}
                        {line.custom && (
                          <div className="muted" style={{ fontSize: "0.8rem" }}>
                            Custom line
                          </div>
                        )}
                      </td>
                      <td style={{ textTransform: "capitalize" }}>
                        {line.category}
                      </td>
                      <td>{formatQuantity(line.quantity, line.unit)}</td>
                      <td>{formatMoney(line.unitPriceCents)}</td>
                      <td>{formatMoney(line.totalCents)}</td>
                      <td>
                        <button
                          type="button"
                          className="btn secondary"
                          style={{
                            fontSize: "0.8rem",
                            padding: "0.35rem 0.55rem",
                          }}
                          onClick={() => removeLine(line.lineKey, line.custom)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="row" style={{ justifyContent: "flex-end" }}>
                <strong style={{ fontSize: "1.2rem" }}>
                  Subtotal {formatMoney(takeoff.subtotalCents)}
                </strong>
              </div>
            </>
          )}

          {takeoff.removedLines.length > 0 && (
            <div className="stack" style={{ marginTop: "0.5rem" }}>
              <strong style={{ fontSize: "0.95rem" }}>Removed line items</strong>
              <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
                Excluded from the subtotal. Restore to put them back.
              </p>
              <table className="table">
                <tbody>
                  {takeoff.removedLines.map((line) => (
                    <tr key={`rm-${line.lineKey}`} style={{ opacity: 0.72 }}>
                      <td>
                        <strong>{line.name}</strong>
                        {line.note && (
                          <div className="muted" style={{ fontSize: "0.85rem" }}>
                            {line.note}
                          </div>
                        )}
                      </td>
                      <td style={{ textTransform: "capitalize" }}>
                        {line.category}
                      </td>
                      <td>{formatQuantity(line.quantity, line.unit)}</td>
                      <td>{formatMoney(line.totalCents)}</td>
                      <td>
                        <button
                          type="button"
                          className="btn secondary"
                          style={{
                            fontSize: "0.8rem",
                            padding: "0.35rem 0.55rem",
                          }}
                          onClick={() => restoreLine(line.lineKey)}
                        >
                          Restore
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {milestoneState === "error" && (
            <p className="error">Could not record estimate milestone.</p>
          )}
        </>
      )}
    </div>
  );
}
