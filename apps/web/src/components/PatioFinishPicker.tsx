"use client";

import { useId } from "react";
import {
  getPatioFinish,
  patioFinishCssColor,
  patioFinishesForPattern,
  patioPatternsInCategory,
  resolvePatioFinish,
  PATIO_FINISH_CATEGORIES,
  PATIO_FINISH_CATEGORY_LABELS,
  PATIO_FINISH_PATTERN_LABELS,
  type PatioFinish,
  type PatioFinishCategory,
  type PatioFinishPattern,
} from "@pool-design/shared";

function PatternPreview({
  pattern,
  color,
  accent,
}: {
  pattern: PatioFinishPattern;
  color: string;
  accent: string;
}) {
  const gid = useId().replace(/:/g, "");
  const common = {
    width: 44,
    height: 32,
    viewBox: "0 0 44 32",
    "aria-hidden": true as const,
  };

  switch (pattern) {
    case "broomed":
      return (
        <svg {...common}>
          <rect width="44" height="32" fill={color} />
          {Array.from({ length: 8 }, (_, i) => (
            <line
              key={i}
              x1="0"
              y1={4 + i * 3.5}
              x2="44"
              y2={4 + i * 3.5}
              stroke={accent}
              strokeWidth="0.8"
              opacity="0.55"
            />
          ))}
        </svg>
      );
    case "smooth":
      return (
        <svg {...common}>
          <defs>
            <linearGradient id={`sm-${gid}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={color} />
              <stop offset="100%" stopColor={accent} />
            </linearGradient>
          </defs>
          <rect width="44" height="32" fill={`url(#sm-${gid})`} />
        </svg>
      );
    case "exposed_aggregate":
      return (
        <svg {...common}>
          <rect width="44" height="32" fill={color} />
          {[
            [6, 8],
            [14, 6],
            [22, 12],
            [30, 7],
            [38, 14],
            [10, 18],
            [18, 22],
            [26, 17],
            [34, 24],
            [8, 26],
            [20, 10],
            [36, 20],
          ].map(([x, y], i) => (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={1.4 + (i % 3) * 0.4}
              fill={accent}
              opacity="0.75"
            />
          ))}
        </svg>
      );
    case "stamped_ashlar":
      return (
        <svg {...common}>
          <rect width="44" height="32" fill={accent} />
          <rect x="1" y="1" width="20" height="14" fill={color} />
          <rect x="23" y="1" width="20" height="14" fill={color} />
          <rect x="1" y="17" width="14" height="14" fill={color} />
          <rect x="17" y="17" width="26" height="14" fill={color} />
        </svg>
      );
    case "stamped_cobble":
      return (
        <svg {...common}>
          <rect width="44" height="32" fill={accent} />
          <ellipse cx="10" cy="10" rx="7" ry="6" fill={color} />
          <ellipse cx="24" cy="9" rx="6" ry="5" fill={color} />
          <ellipse cx="36" cy="12" rx="6" ry="6" fill={color} />
          <ellipse cx="12" cy="22" rx="7" ry="5" fill={color} />
          <ellipse cx="28" cy="23" rx="8" ry="6" fill={color} />
        </svg>
      );
    case "stamped_plank":
      return (
        <svg {...common}>
          <rect width="44" height="32" fill={accent} />
          {[0, 1, 2, 3].map((i) => (
            <rect
              key={i}
              x="1"
              y={1 + i * 8}
              width="42"
              height="6.5"
              fill={color}
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
                x={(row % 2 === 0 ? 0 : 6) + col * 12 + 1}
                y={row * 8 + 1}
                width="10"
                height="6.5"
                fill={color}
              />
            )),
          )}
        </svg>
      );
    case "herringbone":
      return (
        <svg {...common}>
          <rect width="44" height="32" fill={accent} />
          {[
            [4, 4, 45],
            [14, 4, -45],
            [24, 4, 45],
            [34, 4, -45],
            [4, 16, -45],
            [14, 16, 45],
            [24, 16, -45],
            [34, 16, 45],
          ].map(([x, y, rot], i) => (
            <rect
              key={i}
              x={x - 5}
              y={y}
              width="12"
              height="4.5"
              fill={color}
              transform={`rotate(${rot} ${x} ${y + 2})`}
            />
          ))}
        </svg>
      );
    case "basketweave":
      return (
        <svg {...common}>
          <rect width="44" height="32" fill={accent} />
          {[0, 1].map((gy) =>
            [0, 1].map((gx) => {
              const horiz = (gx + gy) % 2 === 0;
              const x = gx * 22 + 1;
              const y = gy * 16 + 1;
              return horiz ? (
                <g key={`${gx}-${gy}`}>
                  <rect x={x} y={y} width="20" height="6.5" fill={color} />
                  <rect x={x} y={y + 8} width="20" height="6.5" fill={color} />
                </g>
              ) : (
                <g key={`${gx}-${gy}`}>
                  <rect x={x} y={y} width="9" height="14.5" fill={color} />
                  <rect x={x + 11} y={y} width="9" height="14.5" fill={color} />
                </g>
              );
            }),
          )}
        </svg>
      );
    case "stack_bond":
      return (
        <svg {...common}>
          <rect width="44" height="32" fill={accent} />
          {[0, 1, 2, 3].map((row) =>
            [0, 1, 2, 3].map((col) => (
              <rect
                key={`${row}-${col}`}
                x={col * 11 + 1}
                y={row * 8 + 1}
                width="9.5"
                height="6.5"
                fill={color}
              />
            )),
          )}
        </svg>
      );
    case "modular":
      return (
        <svg {...common}>
          <rect width="44" height="32" fill={accent} />
          <rect x="1" y="1" width="20" height="14" fill={color} />
          <rect x="23" y="1" width="20" height="14" fill={color} />
          <rect x="1" y="17" width="12" height="14" fill={color} />
          <rect x="15" y="17" width="28" height="14" fill={color} />
        </svg>
      );
    case "travertine":
      return (
        <svg {...common}>
          <rect width="44" height="32" fill={color} />
          <path
            d="M2 10 Q12 6 22 12 T42 10"
            stroke={accent}
            strokeWidth="1.2"
            fill="none"
            opacity="0.55"
          />
          <path
            d="M2 20 Q14 16 24 22 T42 18"
            stroke={accent}
            strokeWidth="1"
            fill="none"
            opacity="0.4"
          />
          <line x1="22" y1="1" x2="22" y2="31" stroke={accent} strokeWidth="1.5" />
          <line x1="1" y1="16" x2="43" y2="16" stroke={accent} strokeWidth="1.5" />
        </svg>
      );
    case "bluestone":
      return (
        <svg {...common}>
          <rect width="44" height="32" fill={accent} />
          <rect x="1" y="1" width="20" height="14" fill={color} />
          <rect x="23" y="1" width="20" height="14" fill={color} />
          <rect x="1" y="17" width="20" height="14" fill={color} />
          <rect x="23" y="17" width="20" height="14" fill={color} />
        </svg>
      );
    case "porcelain":
      return (
        <svg {...common}>
          <rect width="44" height="32" fill={accent} />
          <rect x="2" y="2" width="40" height="28" fill={color} rx="1" />
        </svg>
      );
    case "coral":
      return (
        <svg {...common}>
          <rect width="44" height="32" fill={color} />
          {[
            [8, 10],
            [18, 8],
            [28, 14],
            [36, 9],
            [12, 20],
            [22, 24],
            [32, 22],
          ].map(([x, y], i) => (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={2 + (i % 2)}
              fill={accent}
              opacity="0.45"
            />
          ))}
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
  category: PatioFinishCategory,
  pattern: PatioFinishPattern,
): { color: string; accent: string } {
  const sample = patioFinishesForPattern(category, pattern)[0];
  if (!sample) {
    return { color: "#b8aea0", accent: "#8a8074" };
  }
  return {
    color: patioFinishCssColor(sample.color),
    accent: patioFinishCssColor(sample.accent),
  };
}

export function PatioFinishPicker({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (materialId: string) => void;
}) {
  const finish = getPatioFinish(value);
  const patterns = patioPatternsInCategory(finish.category);
  const colors = patioFinishesForPattern(finish.category, finish.pattern);

  function setCategory(category: PatioFinishCategory) {
    onChange(
      resolvePatioFinish({
        category,
        pattern: finish.pattern,
        colorName: finish.colorName,
      }).id,
    );
  }

  function setPattern(pattern: PatioFinishPattern) {
    onChange(
      resolvePatioFinish({
        category: finish.category,
        pattern,
        colorName: finish.colorName,
      }).id,
    );
  }

  function setColor(next: PatioFinish) {
    onChange(next.id);
  }

  return (
    <div className="patio-finish-picker">
      <div className="field">
        <label htmlFor="patio-finish-category">Category</label>
        <select
          id="patio-finish-category"
          value={finish.category}
          onChange={(e) =>
            setCategory(e.target.value as PatioFinishCategory)
          }
        >
          {PATIO_FINISH_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {PATIO_FINISH_CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>Pattern</label>
        <div className="patio-pattern-grid" role="listbox" aria-label="Pattern">
          {patterns.map((pattern) => {
            const preview = previewColors(finish.category, pattern);
            const selected = pattern === finish.pattern;
            return (
              <button
                key={pattern}
                type="button"
                role="option"
                aria-selected={selected}
                className={`patio-pattern-btn${selected ? " is-selected" : ""}`}
                title={PATIO_FINISH_PATTERN_LABELS[pattern]}
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
                  {PATIO_FINISH_PATTERN_LABELS[pattern]}
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
            const selected = c.id === finish.id;
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
                    background: `linear-gradient(135deg, ${patioFinishCssColor(c.color)} 55%, ${patioFinishCssColor(c.accent)} 55%)`,
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
