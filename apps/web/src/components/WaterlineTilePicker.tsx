"use client";

import {
  WATERLINE_TILE_CATEGORIES,
  WATERLINE_TILE_CATEGORY_LABELS,
  WATERLINE_TILE_PATTERN_LABELS,
  getWaterlineTile,
  resolveWaterlineTile,
  waterlinePatternsInCategory,
  waterlineTileCssColor,
  waterlineTilesForPattern,
  type WaterlineTile,
  type WaterlineTileCategory,
  type WaterlineTilePattern,
} from "@pool-design/shared";

function PatternPreview({
  pattern,
  color,
  accent,
}: {
  pattern: WaterlineTilePattern;
  color: string;
  accent: string;
}) {
  const common = {
    width: 44,
    height: 32,
    viewBox: "0 0 44 32",
    "aria-hidden": true as const,
  };
  switch (pattern) {
    case "grid":
      return (
        <svg {...common}>
          <rect width="44" height="32" fill={accent} />
          {[0, 1].map((row) =>
            [0, 1, 2].map((col) => (
              <rect
                key={`${row}-${col}`}
                x={col * 14 + 1}
                y={row * 15 + 1}
                width="12.5"
                height="13.5"
                fill={color}
              />
            )),
          )}
        </svg>
      );
    case "mosaic":
      return (
        <svg {...common}>
          <rect width="44" height="32" fill={accent} />
          {Array.from({ length: 4 }, (_, row) =>
            Array.from({ length: 6 }, (_, col) => (
              <rect
                key={`${row}-${col}`}
                x={col * 7 + 1}
                y={row * 7.5 + 1}
                width="6"
                height="6.5"
                fill={color}
                opacity={0.7 + ((row + col) % 3) * 0.1}
              />
            )),
          )}
        </svg>
      );
    case "mosaic_offset":
      return (
        <svg {...common}>
          <rect width="44" height="32" fill={accent} />
          {Array.from({ length: 4 }, (_, row) =>
            Array.from({ length: 6 }, (_, col) => (
              <rect
                key={`${row}-${col}`}
                x={(row % 2 ? 3.5 : 0) + col * 7 + 1}
                y={row * 7.5 + 1}
                width="6"
                height="6.5"
                fill={color}
                opacity={0.75 + ((row * 2 + col) % 3) * 0.08}
              />
            )),
          )}
        </svg>
      );
    case "blend_band":
      return (
        <svg {...common}>
          <rect width="44" height="32" fill={accent} />
          {[0, 1, 2, 3].map((row) => (
            <rect
              key={row}
              x="1"
              y={row * 7.5 + 1}
              width="42"
              height="6.5"
              fill={color}
              opacity={0.55 + row * 0.12}
            />
          ))}
        </svg>
      );
    case "running_bond":
      return (
        <svg {...common}>
          <rect width="44" height="32" fill={accent} />
          {[0, 1, 2, 3].map((row) =>
            [-1, 0, 1, 2].map((col) => (
              <rect
                key={`${row}-${col}`}
                x={(row % 2 ? 6 : 0) + col * 12 + 1}
                y={row * 7.5 + 1}
                width="10.5"
                height="6"
                fill={color}
              />
            )),
          )}
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <rect width="44" height="32" fill={color} />
        </svg>
      );
  }
}

function previewColors(
  category: WaterlineTileCategory,
  pattern: WaterlineTilePattern,
) {
  const sample = waterlineTilesForPattern(category, pattern)[0];
  return {
    color: waterlineTileCssColor(sample?.color ?? { r: 100, g: 160, b: 190 }),
    accent: waterlineTileCssColor(sample?.accent ?? { r: 180, g: 185, b: 190 }),
  };
}

export function WaterlineTilePicker({
  value,
  onChange,
  hideEstimateNote = false,
}: {
  value: string | undefined;
  onChange: (tileId: string) => void;
  /** Client / live preview: skip BOM note. */
  hideEstimateNote?: boolean;
}) {
  const tile = getWaterlineTile(value);
  const patterns = waterlinePatternsInCategory(tile.category);
  const colors = waterlineTilesForPattern(tile.category, tile.pattern);

  function setCategory(category: WaterlineTileCategory) {
    onChange(
      resolveWaterlineTile({
        category,
        pattern: tile.pattern,
        colorName: tile.colorName,
      }).id,
    );
  }

  function setPattern(pattern: WaterlineTilePattern) {
    onChange(
      resolveWaterlineTile({
        category: tile.category,
        pattern,
        colorName: tile.colorName,
      }).id,
    );
  }

  function setColor(next: WaterlineTile) {
    onChange(next.id);
  }

  return (
    <div className="patio-finish-picker">
      {!hideEstimateNote ? (
        <p className="muted" style={{ margin: 0, fontSize: "0.78rem" }}>
          Waterline tile band (~6″). Estimate still prices exposed perimeter as
          waterline tile LF.
        </p>
      ) : null}
      <div className="field">
        <label htmlFor="wl-tile-category">Style</label>
        <select
          id="wl-tile-category"
          value={tile.category}
          onChange={(e) =>
            setCategory(e.target.value as WaterlineTileCategory)
          }
        >
          {WATERLINE_TILE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {WATERLINE_TILE_CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>Pattern</label>
        <div className="patio-pattern-grid" role="listbox" aria-label="Pattern">
          {patterns.map((pattern) => {
            const preview = previewColors(tile.category, pattern);
            const selected = pattern === tile.pattern;
            return (
              <button
                key={pattern}
                type="button"
                role="option"
                aria-selected={selected}
                className={`patio-pattern-btn${selected ? " is-selected" : ""}`}
                title={WATERLINE_TILE_PATTERN_LABELS[pattern]}
                onClick={() => setPattern(pattern)}
              >
                <span className="patio-pattern-preview">
                  <PatternPreview
                    pattern={pattern}
                    color={preview.color}
                    accent={preview.accent}
                  />
                </span>
                <span className="patio-pattern-label">
                  {WATERLINE_TILE_PATTERN_LABELS[pattern]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="field">
        <label>Color</label>
        <div className="patio-color-grid" role="listbox" aria-label="Color">
          {colors.map((c) => {
            const selected = c.id === tile.id;
            const blend = c.blend?.[0] ?? c.accent;
            return (
              <button
                key={c.id}
                type="button"
                role="option"
                aria-selected={selected}
                className={`patio-color-btn${selected ? " is-selected" : ""}`}
                title={c.colorName}
                onClick={() => setColor(c)}
              >
                <span
                  className="patio-color-swatch"
                  style={{
                    background: `linear-gradient(135deg, ${waterlineTileCssColor(c.color)} 50%, ${waterlineTileCssColor(blend)} 50%)`,
                  }}
                />
                <span className="patio-color-label">{c.colorName}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
