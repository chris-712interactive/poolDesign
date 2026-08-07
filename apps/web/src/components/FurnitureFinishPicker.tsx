"use client";

import {
  FURNITURE_FINISH_KIND_LABELS,
  furnitureFinishCssColor,
  furnitureFinishesForKind,
  furnitureFinishRoles,
  getFurnitureFinish,
  type FurnitureFinishKind,
} from "@pool-design/shared";

function FinishSwatchRow({
  kind,
  value,
  onChange,
  label,
}: {
  kind: FurnitureFinishKind;
  value: string | undefined;
  onChange: (id: string) => void;
  label?: string;
}) {
  const finishes = furnitureFinishesForKind(kind);
  const current = getFurnitureFinish(
    value,
    finishes[0]?.id ?? "wood_teak",
  );

  return (
    <div className="field">
      <label>{label ?? FURNITURE_FINISH_KIND_LABELS[kind]}</label>
      <div className="patio-color-grid" role="listbox" aria-label={kind}>
        {finishes.map((f) => {
          const selected = f.id === current.id;
          return (
            <button
              key={f.id}
              type="button"
              role="option"
              aria-selected={selected}
              className={`patio-color-btn${selected ? " is-selected" : ""}`}
              title={f.name}
              onClick={() => onChange(f.id)}
            >
              <span
                className="patio-color-swatch"
                style={{
                  background: `linear-gradient(135deg, ${furnitureFinishCssColor(f.color)} 55%, ${furnitureFinishCssColor(f.accent)} 55%)`,
                }}
              />
              <span className="patio-color-label">{f.colorName}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function FurnitureFinishPicker({
  catalogItemId,
  frameFinishId,
  fabricFinishId,
  onFrameChange,
  onFabricChange,
}: {
  catalogItemId: string;
  frameFinishId?: string;
  fabricFinishId?: string;
  onFrameChange: (id: string) => void;
  onFabricChange: (id: string) => void;
}) {
  const roles = furnitureFinishRoles(catalogItemId);
  if (!roles.frame && !roles.fabric && !roles.canopy) return null;

  return (
    <div className="patio-finish-picker">
      {roles.frame && (
        <FinishSwatchRow
          kind="wood"
          value={frameFinishId}
          onChange={onFrameChange}
        />
      )}
      {roles.fabric && (
        <FinishSwatchRow
          kind="fabric"
          value={fabricFinishId}
          onChange={onFabricChange}
        />
      )}
      {roles.canopy && (
        <FinishSwatchRow
          kind="canvas"
          value={fabricFinishId}
          onChange={onFabricChange}
          label={FURNITURE_FINISH_KIND_LABELS.canvas}
        />
      )}
    </div>
  );
}
