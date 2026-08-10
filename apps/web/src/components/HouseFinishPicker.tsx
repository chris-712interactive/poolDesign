"use client";

import {
  HOUSE_EXTERIOR_CUSTOM_ID,
  HOUSE_EXTERIOR_FINISHES,
  houseExteriorColorFromHex,
  houseExteriorCssColor,
  houseExteriorHex,
  resolveHouseExteriorColor,
  resolveHouseExteriorFinishId,
  type HouseExteriorColor,
} from "@pool-design/shared";

type Props = {
  finishId?: string | null;
  customColor?: HouseExteriorColor | null;
  onChange: (next: {
    exteriorFinishId: string;
    exteriorColor?: HouseExteriorColor;
  }) => void;
};

export function HouseFinishPicker({
  finishId,
  customColor,
  onChange,
}: Props) {
  const selectedId = resolveHouseExteriorFinishId(finishId);
  const isCustom = selectedId === HOUSE_EXTERIOR_CUSTOM_ID;
  const resolved = resolveHouseExteriorColor(finishId, customColor);
  const hex = houseExteriorHex(resolved);

  return (
    <div className="stack" style={{ gap: "0.45rem" }}>
      <div className="muted" style={{ fontSize: "0.8rem" }}>
        Exterior color
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(4.5rem, 1fr))",
          gap: "0.35rem",
        }}
      >
        {HOUSE_EXTERIOR_FINISHES.map((finish) => {
          const active = !isCustom && finish.id === selectedId;
          const css = houseExteriorCssColor(finish.color);
          return (
            <button
              key={finish.id}
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
                onChange({ exteriorFinishId: finish.id, exteriorColor: undefined })
              }
              title={finish.name}
            >
              <span
                aria-hidden
                style={{
                  width: "100%",
                  height: 28,
                  borderRadius: 4,
                  background: css,
                  boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.12)",
                }}
              />
              <span style={{ fontSize: "0.72rem", lineHeight: 1.2 }}>
                {finish.colorName}
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
        <button
          type="button"
          className={`btn secondary ${isCustom ? "active" : ""}`}
          style={{
            padding: "0.35rem 0.55rem",
            border: isCustom
              ? "2px solid var(--accent, #1f8a70)"
              : "1px solid rgba(20,32,41,0.12)",
          }}
          onClick={() =>
            onChange({
              exteriorFinishId: HOUSE_EXTERIOR_CUSTOM_ID,
              exteriorColor: resolved,
            })
          }
        >
          Custom
        </button>
        <input
          type="color"
          aria-label="Custom exterior color"
          value={hex}
          onChange={(e) => {
            const color = houseExteriorColorFromHex(e.target.value);
            if (!color) return;
            onChange({
              exteriorFinishId: HOUSE_EXTERIOR_CUSTOM_ID,
              exteriorColor: color,
            });
          }}
          style={{
            width: 42,
            height: 32,
            padding: 0,
            border: "1px solid rgba(20,32,41,0.18)",
            borderRadius: 6,
            background: "transparent",
            cursor: "pointer",
          }}
        />
        <span className="muted" style={{ fontSize: "0.78rem" }}>
          {isCustom ? hex.toUpperCase() : "Or pick any RGB"}
        </span>
      </div>
    </div>
  );
}
