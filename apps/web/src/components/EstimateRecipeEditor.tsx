"use client";

import { useMemo } from "react";
import {
  QUANTITY_SOURCES,
  formatMoney,
  newEstimateRecipeLine,
  quantitySourceById,
  type CatalogCategory,
  type CatalogUnit,
  type EstimateRecipe,
  type EstimateRecipeLine,
} from "@pool-design/shared";

const CATEGORIES: Array<CatalogCategory | "other"> = [
  "structure",
  "finish",
  "hardscape",
  "plumbing",
  "equipment",
  "labor",
  "other",
];

const UNITS: CatalogUnit[] = [
  "ea",
  "lf",
  "sf",
  "sy",
  "cy",
  "gal",
  "hr",
  "lb",
  "kg",
  "m",
  "m2",
  "m3",
];

const SOURCE_GROUPS = [...new Set(QUANTITY_SOURCES.map((s) => s.group))];

type Props = {
  recipe: EstimateRecipe;
  onChange: (next: EstimateRecipe) => void;
  disabled?: boolean;
};

function patchLine(
  recipe: EstimateRecipe,
  id: string,
  patch: Partial<EstimateRecipeLine>,
): EstimateRecipe {
  return {
    version: 1,
    lines: recipe.lines.map((line) =>
      line.id === id ? { ...line, ...patch } : line,
    ),
  };
}

export function EstimateRecipeEditor({ recipe, onChange, disabled }: Props) {
  const sourcesByGroup = useMemo(
    () =>
      SOURCE_GROUPS.map((group) => ({
        group,
        sources: QUANTITY_SOURCES.filter((s) => s.group === group),
      })),
    [],
  );

  return (
    <div className="proposal-table-wrap">
      <table className="proposal-table recipe-table">
        <thead>
          <tr>
            <th>On</th>
            <th>Item</th>
            <th>Priced from</th>
            <th>×</th>
            <th>Unit</th>
            <th>Unit price</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {recipe.lines.map((line) => {
            const source = quantitySourceById(line.quantitySourceId);
            const manual = line.quantitySourceId === "manual";
            return (
              <tr key={line.id} style={{ opacity: line.enabled ? 1 : 0.55 }}>
                <td>
                  <input
                    type="checkbox"
                    checked={line.enabled}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        patchLine(recipe, line.id, {
                          enabled: e.target.checked,
                        }),
                      )
                    }
                    aria-label={`Include ${line.name}`}
                  />
                </td>
                <td>
                  <input
                    value={line.name}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        patchLine(recipe, line.id, { name: e.target.value }),
                      )
                    }
                    style={{ width: "12rem" }}
                  />
                  <div className="muted" style={{ marginTop: "0.25rem" }}>
                    <select
                      value={line.category}
                      disabled={disabled}
                      onChange={(e) =>
                        onChange(
                          patchLine(recipe, line.id, {
                            category: e.target.value as CatalogCategory | "other",
                          }),
                        )
                      }
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </td>
                <td>
                  <select
                    value={line.quantitySourceId}
                    disabled={disabled}
                    onChange={(e) => {
                      const quantitySourceId = e.target.value;
                      const next = quantitySourceById(quantitySourceId);
                      onChange(
                        patchLine(recipe, line.id, {
                          quantitySourceId,
                          unit: next?.unit ?? line.unit,
                          manualQuantity:
                            quantitySourceId === "manual"
                              ? (line.manualQuantity ?? 1)
                              : line.manualQuantity,
                        }),
                      );
                    }}
                    title={source?.hint}
                    style={{ maxWidth: "16rem" }}
                  >
                    {sourcesByGroup.map((g) => (
                      <optgroup key={g.group} label={g.group}>
                        {g.sources.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  {source?.hint ? (
                    <div className="muted" style={{ fontSize: "0.8rem" }}>
                      {source.hint}
                    </div>
                  ) : null}
                </td>
                <td>
                  {manual ? (
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      disabled={disabled}
                      value={line.manualQuantity ?? 1}
                      onChange={(e) =>
                        onChange(
                          patchLine(recipe, line.id, {
                            manualQuantity: Number(e.target.value),
                          }),
                        )
                      }
                      title="Quantity"
                      style={{ width: "4.5rem" }}
                    />
                  ) : (
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      disabled={disabled}
                      value={line.multiplier}
                      onChange={(e) =>
                        onChange(
                          patchLine(recipe, line.id, {
                            multiplier: Number(e.target.value),
                          }),
                        )
                      }
                      title="Multiplier (1.08 = 8% waste)"
                      style={{ width: "4.5rem" }}
                    />
                  )}
                </td>
                <td>
                  <select
                    value={line.unit}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        patchLine(recipe, line.id, {
                          unit: e.target.value as CatalogUnit,
                        }),
                      )
                    }
                  >
                    {UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    disabled={disabled}
                    value={(line.unitPriceCents / 100).toFixed(2)}
                    onChange={(e) => {
                      const dollars = Number(e.target.value);
                      onChange(
                        patchLine(recipe, line.id, {
                          unitPriceCents: Number.isFinite(dollars)
                            ? Math.round(dollars * 100)
                            : 0,
                        }),
                      );
                    }}
                    style={{ width: "6.5rem" }}
                  />
                  <div className="muted" style={{ fontSize: "0.75rem" }}>
                    {formatMoney(line.unitPriceCents)}/{line.unit}
                  </div>
                </td>
                <td>
                  <button
                    type="button"
                    className="btn secondary"
                    disabled={disabled}
                    style={{ fontSize: "0.8rem", padding: "0.35rem 0.55rem" }}
                    onClick={() =>
                      onChange({
                        version: 1,
                        lines: recipe.lines.filter((l) => l.id !== line.id),
                      })
                    }
                  >
                    Remove
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="row" style={{ marginTop: "0.75rem" }}>
        <button
          type="button"
          className="btn secondary"
          disabled={disabled}
          onClick={() =>
            onChange({
              version: 1,
              lines: [...recipe.lines, newEstimateRecipeLine()],
            })
          }
        >
          Add line
        </button>
      </div>
    </div>
  );
}
