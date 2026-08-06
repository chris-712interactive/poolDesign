import { DESIGN_LEVEL_CONFIG, type DesignLevel } from "./design-level";
import type { UnitSystem } from "./units";
import {
  DEFAULT_PATIO_ROOF_HEIGHT_MM,
  DEFAULT_PERGOLA_HEIGHT_MM,
  DEFAULT_SPA_SHELL_HEIGHT_MM,
  DEFAULT_SPA_WALL_THICKNESS_MM,
  defaultOpeningSize,
  emptyDesignDocument,
  type DesignDocument,
} from "./design-model";

/** Current document schema version written by the app. */
export const DESIGN_DOCUMENT_VERSION = 1;

/**
 * Coerce a partially-shaped / older design into a valid DesignDocument.
 * Safe to call on load and before save. Keeps version at 1 for now; bump
 * DESIGN_DOCUMENT_VERSION and add migration steps here when the schema changes.
 */
export function normalizeDesignDocument(
  doc: DesignDocument,
  opts?: { designLevel?: DesignLevel; unitSystem?: UnitSystem },
): DesignDocument {
  const designLevel = opts?.designLevel ?? doc.designLevel ?? "residential";
  const unitSystem = opts?.unitSystem ?? doc.unitSystem ?? "imperial";

  let layers = Array.isArray(doc.layers) ? [...doc.layers] : [];
  if (!layers.some((l) => l.id === "features")) {
    layers = [...layers, { id: "features", name: "features", visible: true }];
  }
  if (!layers.some((l) => l.id === "equipment")) {
    layers = [...layers, { id: "equipment", name: "equipment", visible: true }];
  }
  if (
    !layers.some((l) => l.id === "house") &&
    !layers.some((l) => l.id === "building")
  ) {
    layers = [{ id: "house", name: "house", visible: true }, ...layers];
  }
  if (!layers.some((l) => l.id === "covers")) {
    layers = [...layers, { id: "covers", name: "covers", visible: true }];
  }

  return {
    ...doc,
    version: DESIGN_DOCUMENT_VERSION,
    designLevel,
    unitSystem,
    objects: Array.isArray(doc.objects) ? doc.objects : [],
    features: Array.isArray(doc.features) ? doc.features : [],
    patios: Array.isArray(doc.patios) ? doc.patios : [],
    buildings: (Array.isArray(doc.buildings) ? doc.buildings : []).map((b) => ({
      ...b,
      stories: Math.max(1, b.stories || 1),
      kind: b.kind ?? "house",
      openings: (b.openings ?? []).map((o) => {
        const defaults = defaultOpeningSize(
          o.kind === "sliding_door" || o.kind === "window" ? o.kind : "door",
        );
        return {
          ...o,
          kind:
            o.kind === "sliding_door" || o.kind === "window"
              ? o.kind
              : "door",
          widthMm: o.widthMm > 0 ? o.widthMm : defaults.widthMm,
          heightMm: o.heightMm > 0 ? o.heightMm : defaults.heightMm,
          edgeIndex: Math.max(0, o.edgeIndex | 0),
          t: Math.min(1, Math.max(0, o.t ?? 0.5)),
        };
      }),
    })),
    patioCovers: (Array.isArray(doc.patioCovers) ? doc.patioCovers : []).map(
      (c) => ({
        ...c,
        kind: c.kind === "roof" ? "roof" : "pergola",
        heightMm:
          c.heightMm ??
          (c.kind === "roof"
            ? DEFAULT_PATIO_ROOF_HEIGHT_MM
            : DEFAULT_PERGOLA_HEIGHT_MM),
      }),
    ),
    layers,
    poolBodies: (Array.isArray(doc.poolBodies) ? doc.poolBodies : []).map(
      (p) => ({
        ...p,
        kind: p.kind ?? "pool",
        wallThicknessMm:
          (p.kind ?? "pool") === "spa"
            ? (p.wallThicknessMm ?? DEFAULT_SPA_WALL_THICKNESS_MM)
            : p.wallThicknessMm,
        shellHeightMm:
          (p.kind ?? "pool") === "spa"
            ? (p.shellHeightMm ?? DEFAULT_SPA_SHELL_HEIGHT_MM)
            : p.shellHeightMm,
      }),
    ),
    plumbingRuns: Array.isArray(doc.plumbingRuns) ? doc.plumbingRuns : [],
  };
}

/**
 * Parse stored JSON into a normalized DesignDocument.
 * Falls back to an empty document when the payload is invalid.
 */
export function parseDesignDocument(
  json: string,
  designLevel: DesignLevel,
  unitSystem: UnitSystem,
): DesignDocument {
  try {
    const parsed = JSON.parse(json) as DesignDocument;
    if (parsed && typeof parsed === "object") {
      return normalizeDesignDocument(parsed, { designLevel, unitSystem });
    }
  } catch {
    // fall through
  }
  return emptyDesignDocument(
    designLevel,
    unitSystem,
    DESIGN_LEVEL_CONFIG[designLevel].defaultLayers,
  );
}
