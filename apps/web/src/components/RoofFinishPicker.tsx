"use client";

import type { CSSProperties } from "react";
import {
  ROOF_COLOR_PRESETS,
  ROOF_MATERIAL_IDS,
  ROOF_MATERIAL_LABELS,
  roofColorFromHex,
  roofColorHex,
  roofCssColor,
  resolveRoofColor,
  resolveRoofMaterialId,
  type RoofColor,
  type RoofMaterialId,
} from "@pool-design/shared";

export type RoofFinishChange = {
  finishId: RoofMaterialId;
  color: RoofColor;
};

type Props = {
  finishId?: string | null;
  color?: RoofColor | null;
  onChange: (next: RoofFinishChange) => void;
};

const chipStyle = (active: boolean): CSSProperties => ({
  appearance: "none",
  cursor: "pointer",
  padding: "0.3rem 0.5rem",
  borderRadius: 8,
  fontWeight: 700,
  fontSize: "0.78rem",
  background: active ? "white" : "transparent",
  color: active ? "var(--panel-ink)" : "var(--muted)",
  border: active
    ? "2px solid var(--accent, #1f8a70)"
    : "1px solid rgba(20,32,41,0.12)",
  boxShadow: active ? "0 1px 3px rgba(20,32,41,0.08)" : "none",
});

export function RoofFinishPicker({ finishId, color, onChange }: Props) {
  const materialId = resolveRoofMaterialId(finishId);
  const resolved = resolveRoofColor(materialId, color);

  return (
    <div className="stack" style={{ gap: "0.45rem" }}>
      <div className="muted" style={{ fontSize: "0.8rem" }}>
        Roof material
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.3rem",
        }}
      >
        {ROOF_MATERIAL_IDS.map((id) => (
          <button
            key={id}
            type="button"
            style={chipStyle(id === materialId)}
            onClick={() =>
              onChange({
                finishId: id,
                color: resolveRoofColor(id, color),
              })
            }
          >
            {ROOF_MATERIAL_LABELS[id]}
          </button>
        ))}
      </div>
      <div className="muted" style={{ fontSize: "0.8rem" }}>
        Roof color
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(4.5rem, 1fr))",
          gap: "0.35rem",
        }}
      >
        {ROOF_COLOR_PRESETS.map((preset) => {
          const active =
            Math.abs(preset.color.r - resolved.r) +
              Math.abs(preset.color.g - resolved.g) +
              Math.abs(preset.color.b - resolved.b) <
            12;
          return (
            <button
              key={preset.id}
              type="button"
              className={`btn secondary ${active ? "active" : ""}`}
              style={{
                padding: "0.35rem",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "0.25rem",
                border: active
                  ? "2px solid var(--accent, #1f8a70)"
                  : "1px solid rgba(20,32,41,0.12)",
              }}
              onClick={() =>
                onChange({ finishId: materialId, color: preset.color })
              }
              title={preset.name}
            >
              <span
                aria-hidden
                style={{
                  width: "100%",
                  height: 28,
                  borderRadius: 4,
                  background: roofCssColor(preset.color),
                  boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.12)",
                }}
              />
              <span style={{ fontSize: "0.72rem", lineHeight: 1.2 }}>
                {preset.name}
              </span>
            </button>
          );
        })}
      </div>
      <div
        className="field"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.55rem",
          marginTop: "0.15rem",
        }}
      >
        <label htmlFor="roof-custom-color" style={{ margin: 0 }}>
          Custom
        </label>
        <input
          id="roof-custom-color"
          type="color"
          value={roofColorHex(resolved)}
          onChange={(e) => {
            const next = roofColorFromHex(e.target.value);
            if (!next) return;
            onChange({ finishId: materialId, color: next });
          }}
        />
      </div>
    </div>
  );
}
