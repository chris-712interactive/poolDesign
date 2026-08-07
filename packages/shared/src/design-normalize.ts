import type { CatalogCategory, CatalogUnit } from "./catalog";
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
  type DesignEstimate,
  type EstimateCustomLine,
} from "./design-model";

const ESTIMATE_UNITS: CatalogUnit[] = [
  "ea",
  "lf",
  "sf",
  "sy",
  "hr",
  "lb",
  "kg",
  "m",
  "m2",
];
const ESTIMATE_CATEGORIES: Array<CatalogCategory | "other"> = [
  "structure",
  "finish",
  "hardscape",
  "plumbing",
  "equipment",
  "labor",
  "other",
];
import {
  normalizeDepthStations,
  syncShallowDeepFromStations,
} from "./depth-profile";
import { createCoverSupports } from "./cover-supports";
import {
  DEFAULT_PATIO_FINISH_ID,
  isPatioFinishId,
} from "./patio-finishes";
import {
  DINING_CHAIR_CLEARANCE_MM,
  diningSetCatalogId,
} from "./object-library";
import { clampOpeningStory, defaultObjectHeightMm } from "./scene3d";

const FT = 304.8;

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
    objects: (Array.isArray(doc.objects) ? doc.objects : []).map((o) => {
      let catalogItemId = o.catalogItemId;
      let widthMm = o.widthMm;
      let depthMm = o.depthMm;
      let name = o.name;

      // Legacy dining_table_set stored overall footprint (~6×6). Migrate to
      // round tabletop semantics (width/depth = tabletop).
      if (catalogItemId === "dining_table_set") {
        catalogItemId = diningSetCatalogId("round");
        name =
          name === "Dining table set" || name === "Dining set (round)"
            ? "Dining set (round)"
            : name;
        const legacyOverall = 6 * FT;
        if (
          Math.abs(widthMm - legacyOverall) < 50 &&
          Math.abs(depthMm - legacyOverall) < 50
        ) {
          const table = legacyOverall - DINING_CHAIR_CLEARANCE_MM * 2;
          widthMm = Math.max(3 * FT, table);
          depthMm = widthMm;
        }
      } else if (catalogItemId === "dining_table_round") {
        // Keep round tabletops square (diameter).
        const dia = Math.max(widthMm, depthMm);
        widthMm = dia;
        depthMm = dia;
      }

      return {
        ...o,
        catalogItemId,
        name,
        widthMm,
        depthMm,
        heightMm:
          o.heightMm != null && o.heightMm > 0
            ? o.heightMm
            : defaultObjectHeightMm(catalogItemId),
      };
    }),
    features: Array.isArray(doc.features) ? doc.features : [],
    patios: (Array.isArray(doc.patios) ? doc.patios : []).map((p) => ({
      ...p,
      materialId:
        p.materialId && isPatioFinishId(p.materialId)
          ? p.materialId
          : DEFAULT_PATIO_FINISH_ID,
    })),
    buildings: (Array.isArray(doc.buildings) ? doc.buildings : []).map((b) => {
      const stories = Math.max(1, b.stories || 1);
      return {
        ...b,
        stories,
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
            story: clampOpeningStory(o.story, stories),
          };
        }),
      };
    }),
    patioCovers: (Array.isArray(doc.patioCovers) ? doc.patioCovers : []).map(
      (c) => {
        const kind = c.kind === "roof" ? "roof" : "pergola";
        const heightMm =
          c.heightMm ??
          (kind === "roof"
            ? DEFAULT_PATIO_ROOF_HEIGHT_MM
            : DEFAULT_PERGOLA_HEIGHT_MM);
        const buildings = Array.isArray(doc.buildings) ? doc.buildings : [];
        const supports =
          Array.isArray(c.supports) && c.supports.length > 0
            ? c.supports.map((s, i) => ({
                ...s,
                id: s.id || `sup_${c.id}_${i}`,
                position: s.position ?? { x: 0, y: 0 },
              }))
            : createCoverSupports(
                c.outline ?? [],
                buildings,
                (i) => `sup_${c.id}_${i}`,
              );
        return { ...c, kind, heightMm, supports };
      },
    ),
    layers,
    poolBodies: (Array.isArray(doc.poolBodies) ? doc.poolBodies : []).map(
      (p) => {
        const kind = p.kind ?? "pool";
        const base = {
          ...p,
          kind,
          wallThicknessMm:
            kind === "spa"
              ? (p.wallThicknessMm ?? DEFAULT_SPA_WALL_THICKNESS_MM)
              : p.wallThicknessMm,
          shellHeightMm:
            kind === "spa"
              ? (p.shellHeightMm ?? DEFAULT_SPA_SHELL_HEIGHT_MM)
              : p.shellHeightMm,
        };
        if (
          kind === "pool" &&
          Array.isArray(p.depthStations) &&
          p.depthStations.length >= 2
        ) {
          return syncShallowDeepFromStations({
            ...base,
            depthStations: normalizeDepthStations(
              p.depthStations,
              p.depthShallowMm,
              p.depthDeepMm,
            ),
          });
        }
        return base;
      },
    ),
    plumbingRuns: Array.isArray(doc.plumbingRuns) ? doc.plumbingRuns : [],
    estimate: normalizeEstimate(doc.estimate),
  };
}

function normalizeEstimate(estimate: DesignEstimate | undefined): DesignEstimate {
  const removedLineKeys = Array.isArray(estimate?.removedLineKeys)
    ? [
        ...new Set(
          estimate.removedLineKeys.filter(
            (k): k is string => typeof k === "string" && k.length > 0,
          ),
        ),
      ]
    : [];
  const customLines: EstimateCustomLine[] = Array.isArray(estimate?.customLines)
    ? estimate.customLines
        .filter(
          (l) =>
            l &&
            typeof l.id === "string" &&
            typeof l.name === "string" &&
            l.name.trim().length > 0 &&
            typeof l.quantity === "number" &&
            Number.isFinite(l.quantity) &&
            typeof l.unitPriceCents === "number" &&
            Number.isFinite(l.unitPriceCents),
        )
        .map((l) => {
          const category = ESTIMATE_CATEGORIES.includes(
            l.category as CatalogCategory | "other",
          )
            ? (l.category as CatalogCategory | "other")
            : "other";
          const unit = ESTIMATE_UNITS.includes(l.unit as CatalogUnit)
            ? (l.unit as CatalogUnit)
            : "ea";
          return {
            id: l.id,
            name: l.name.trim(),
            category,
            unit,
            quantity: Math.max(0, l.quantity),
            unitPriceCents: Math.max(0, Math.round(l.unitPriceCents)),
            note:
              typeof l.note === "string" && l.note.trim()
                ? l.note.trim()
                : undefined,
          };
        })
    : [];
  return { removedLineKeys, customLines };
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
