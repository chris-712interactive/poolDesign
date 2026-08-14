import type { CatalogCategory, CatalogUnit } from "./catalog";
import { DESIGN_LEVEL_CONFIG, type DesignLevel } from "./design-level";
import type { UnitSystem } from "./units";
import {
  DEFAULT_PATIO_ROOF_HEIGHT_MM,
  DEFAULT_PERGOLA_HEIGHT_MM,
  DEFAULT_SPA_SHELL_HEIGHT_MM,
  DEFAULT_SPA_WALL_THICKNESS_MM,
  DEFAULT_POOL_WALL_THICKNESS_MM,
  defaultFenceHeightMm,
  defaultGateSize,
  defaultOpeningSize,
  DEFAULT_RETAINING_TRIGGER_MM,
  emptyDesignDocument,
  isFenceKind,
  isGateKind,
  normalizeNorthDeg,
  type DesignDocument,
  type DesignEstimate,
  type DesignGradeOptions,
  type EstimateCustomLine,
  type FenceGate,
  type FenceRun,
  type GradeSample,
  type PatioGradeStrategy,
  type SpaSpillover,
  isSpaSpilloverStyle,
  type SpaSpilloverWeir,
  type InfinityEdge,
  type InfinityEdgeWeir,
  type InfinityTrough,
  isInfinityEdgeStyle,
} from "./design-model";
import {
  isWallWaterFixtureId,
  snapWaterWallFixture,
} from "./water-fixtures";
import { repairAutoPlumbingIfNeeded } from "./plumbing-route";

const IN = 25.4;
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
  "cy",
  "gal",
];

const PATIO_GRADE_STRATEGIES: PatioGradeStrategy[] = [
  "fill",
  "retaining",
  "both",
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
  DEFAULT_WATERLINE_TILE_ID,
  isWaterlineTileId,
  waterlineNosingBandMm,
} from "./waterline-tiles";
import {
  defaultFabricFinishId,
  defaultFrameFinishId,
  furnitureFinishRoles,
  getFurnitureFinish,
  isFurnitureFinishId,
} from "./furniture-finishes";
import {
  isFenceFinishId,
  resolveFenceFinish,
} from "./fence-finishes";
import {
  HOUSE_EXTERIOR_CUSTOM_ID,
  clampHouseExteriorColor,
  resolveHouseExteriorFinishId,
} from "./house-finishes";
import {
  DINING_CHAIR_CLEARANCE_MM,
  diningSetCatalogId,
} from "./object-library";
import {
  clampOpeningStory,
  defaultObjectHeightMm,
  defaultSillAboveFloorMm,
  openingSillAboveFloorMm,
  resolveCeilingHeightMm,
} from "./scene3d";
import {
  defaultPersonHeightMm,
  personFootprintMm,
  resolvePersonHeightMm,
  resolvePersonOutfitId,
  resolvePersonSex,
} from "./person-options";
import { normalizeSurveyUnderlay } from "./survey-underlay";
import { normalizeSiteLines } from "./site-lines";

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
  if (!layers.some((l) => l.id === "fence")) {
    layers = [...layers, { id: "fence", name: "fence", visible: true }];
  }
  if (!layers.some((l) => l.id === "survey")) {
    layers = [...layers, { id: "survey", name: "survey", visible: true }];
  }
  if (!layers.some((l) => l.id === "site")) {
    layers = [...layers, { id: "site", name: "site", visible: true }];
  }

  const normalized: DesignDocument = {
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

      const roles = furnitureFinishRoles(catalogItemId);
      let frameFinishId = o.frameFinishId;
      let fabricFinishId = o.fabricFinishId;
      if (roles.frame) {
        frameFinishId =
          isFurnitureFinishId(frameFinishId) &&
          getFurnitureFinish(frameFinishId).kind === "wood"
            ? frameFinishId
            : defaultFrameFinishId(catalogItemId);
      } else {
        frameFinishId = undefined;
      }
      if (roles.fabric) {
        fabricFinishId =
          isFurnitureFinishId(fabricFinishId) &&
          getFurnitureFinish(fabricFinishId).kind === "fabric"
            ? fabricFinishId
            : defaultFabricFinishId(catalogItemId);
      } else if (roles.canopy) {
        fabricFinishId =
          isFurnitureFinishId(fabricFinishId) &&
          getFurnitureFinish(fabricFinishId).kind === "canvas"
            ? fabricFinishId
            : defaultFabricFinishId(catalogItemId);
      } else {
        fabricFinishId = undefined;
      }

      const isBubbler =
        catalogItemId === "spa_bubbler" || catalogItemId === "pool_bubbler";
      const isPerson = catalogItemId === "person_scale";

      // Pull lights/jets onto the nearest pool/spa wall and face them inward.
      let position = o.position;
      let rotationDeg = o.rotationDeg;
      let parentBodyId = o.parentBodyId;
      if (isWallWaterFixtureId(catalogItemId) && Array.isArray(doc.poolBodies)) {
        const snap = snapWaterWallFixture(doc.poolBodies, o.position, 2500);
        if (snap) {
          position = snap.position;
          rotationDeg = snap.rotationDeg;
          parentBodyId = snap.bodyId;
        }
      }

      let personSex: "female" | "male" | undefined;
      let personOutfitId: string | undefined;
      let heightMm =
        o.heightMm != null && o.heightMm > 0
          ? o.heightMm
          : defaultObjectHeightMm(catalogItemId);
      let nextWidth = widthMm;
      let nextDepth = depthMm;
      if (isPerson) {
        personSex = resolvePersonSex(o.personSex);
        personOutfitId = resolvePersonOutfitId(o.personOutfitId);
        heightMm = resolvePersonHeightMm(
          o.heightMm != null && o.heightMm > 0
            ? o.heightMm
            : defaultPersonHeightMm(personSex),
        );
        const foot = personFootprintMm(heightMm, personSex);
        nextWidth = foot.widthMm;
        nextDepth = foot.depthMm;
      }

      return {
        ...o,
        catalogItemId,
        name,
        widthMm: nextWidth,
        depthMm: nextDepth,
        position,
        rotationDeg,
        parentBodyId,
        frameFinishId,
        fabricFinishId,
        heightMm,
        hasLedLight: isBubbler ? o.hasLedLight === true : undefined,
        personSex,
        personOutfitId,
      };
    }),
    features: (Array.isArray(doc.features) ? doc.features : []).map((f) => ({
      ...f,
      waterlineTiles: f.waterlineTiles === false ? false : undefined,
      waterlineTileId:
        f.waterlineTileId && isWaterlineTileId(f.waterlineTileId)
          ? f.waterlineTileId
          : undefined,
      waterlineNosingBandMm:
        typeof f.waterlineNosingBandMm === "number" &&
        Number.isFinite(f.waterlineNosingBandMm)
          ? waterlineNosingBandMm(f.waterlineNosingBandMm)
          : undefined,
    })),
    patios: (Array.isArray(doc.patios) ? doc.patios : []).map((p) => ({
      ...p,
      materialId:
        p.materialId && isPatioFinishId(p.materialId)
          ? p.materialId
          : DEFAULT_PATIO_FINISH_ID,
      gradeStrategy: PATIO_GRADE_STRATEGIES.includes(
        p.gradeStrategy as PatioGradeStrategy,
      )
        ? (p.gradeStrategy as PatioGradeStrategy)
        : "both",
    })),
    gradeSamples: normalizeGradeSamples(doc.gradeSamples),
    gradeOptions: normalizeGradeOptions(doc.gradeOptions),
    northDeg: normalizeNorthDeg(doc.northDeg),
    surveyUnderlay: normalizeSurveyUnderlay(doc.surveyUnderlay),
    buildings: (Array.isArray(doc.buildings) ? doc.buildings : []).map((b) => {
      const stories = Math.max(1, b.stories || 1);
      const ceilingHeightMm = resolveCeilingHeightMm(
        typeof b.ceilingHeightMm === "number" ? b.ceilingHeightMm : undefined,
      );
      const exteriorFinishId = resolveHouseExteriorFinishId(
        b.exteriorFinishId,
      );
      const exteriorColor =
        exteriorFinishId === HOUSE_EXTERIOR_CUSTOM_ID
          ? clampHouseExteriorColor(b.exteriorColor)
          : undefined;
      return {
        ...b,
        stories,
        ceilingHeightMm,
        kind: b.kind ?? "house",
        exteriorFinishId,
        ...(exteriorColor ? { exteriorColor } : { exteriorColor: undefined }),
        openings: (b.openings ?? []).map((o) => {
          const kind =
            o.kind === "sliding_door" || o.kind === "window"
              ? o.kind
              : "door";
          const defaults = defaultOpeningSize(kind);
          return {
            ...o,
            kind,
            widthMm: o.widthMm > 0 ? o.widthMm : defaults.widthMm,
            heightMm: o.heightMm > 0 ? o.heightMm : defaults.heightMm,
            edgeIndex: Math.max(0, o.edgeIndex | 0),
            t: Math.min(1, Math.max(0, o.t ?? 0.5)),
            story: clampOpeningStory(o.story, stories),
            sillAboveFloorMm: openingSillAboveFloorMm(
              kind,
              typeof o.sillAboveFloorMm === "number"
                ? o.sillAboveFloorMm
                : defaultSillAboveFloorMm(kind),
            ),
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
              : (p.wallThicknessMm ?? DEFAULT_POOL_WALL_THICKNESS_MM),
          shellHeightMm:
            kind === "spa"
              ? (p.shellHeightMm ?? DEFAULT_SPA_SHELL_HEIGHT_MM)
              : p.shellHeightMm,
          spillover:
            kind === "spa" ? normalizeSpaSpillover(p.spillover) : undefined,
          infinityEdge:
            kind === "pool" ? normalizeInfinityEdge(p.infinityEdge) : undefined,
          waterlineTileId:
            p.waterlineTileId && isWaterlineTileId(p.waterlineTileId)
              ? p.waterlineTileId
              : DEFAULT_WATERLINE_TILE_ID,
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
    fences: normalizeFences(doc.fences),
    siteLines: normalizeSiteLines(doc.siteLines),
    estimate: normalizeEstimate(doc.estimate),
  };
  // Rebuild auto trenches only when they currently clip a house foundation.
  return repairAutoPlumbingIfNeeded(normalized);
}

function clampFinite(n: unknown, fallback: number, min: number, max: number): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Clamp authorable spa spillover fields; undefined when absent. */
function normalizeSpaSpillover(
  raw: SpaSpillover | undefined,
): SpaSpillover | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const style = isSpaSpilloverStyle(raw.style) ? raw.style : undefined;
  const out: SpaSpillover = {
    enabled: raw.enabled !== false,
  };
  if (typeof raw.targetPoolId === "string" && raw.targetPoolId.trim()) {
    out.targetPoolId = raw.targetPoolId.trim();
  }
  if (Array.isArray(raw.weirs)) {
    out.weirs = raw.weirs
      .filter(
        (w) =>
          w &&
          typeof w === "object" &&
          typeof w.edgeIndex === "number" &&
          Number.isFinite(w.edgeIndex),
      )
      .map((w) => {
        const weir: SpaSpilloverWeir = {
          edgeIndex: Math.max(0, Math.floor(w.edgeIndex)),
        };
        if (w.enabled === false) weir.enabled = false;
        if (w.widthMm != null) {
          weir.widthMm = clampFinite(w.widthMm, 24 * IN, 50, 50_000);
        }
        if (w.offsetMm != null) {
          weir.offsetMm = clampFinite(w.offsetMm, 0, -20_000, 20_000);
        }
        return weir;
      });
  } else if (
    typeof raw.edgeIndex === "number" &&
    Number.isFinite(raw.edgeIndex)
  ) {
    // Migrate legacy single-edge fields into weirs[].
    const weir: SpaSpilloverWeir = {
      edgeIndex: Math.max(0, Math.floor(raw.edgeIndex)),
      enabled: true,
    };
    if (raw.widthMm != null) {
      weir.widthMm = clampFinite(raw.widthMm, 24 * IN, 50, 50_000);
    }
    if (raw.offsetMm != null) {
      weir.offsetMm = clampFinite(raw.offsetMm, 0, -20_000, 20_000);
    }
    out.weirs = [weir];
  }
  if (raw.notchDepthMm != null) {
    out.notchDepthMm = clampFinite(raw.notchDepthMm, 1.5 * IN, 5, 600);
  }
  if (style) out.style = style;
  if (raw.scupperCount != null) {
    out.scupperCount = Math.round(clampFinite(raw.scupperCount, 3, 2, 8));
  }
  if (raw.scupperGapMm != null) {
    out.scupperGapMm = clampFinite(raw.scupperGapMm, 4 * IN, 10, 2000);
  }
  if (raw.enabled === false) out.enabled = false;
  return out;
}

/** Clamp authorable pool infinity-edge fields; undefined when absent. */
function normalizeInfinityEdge(
  raw: InfinityEdge | undefined,
): InfinityEdge | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const style = isInfinityEdgeStyle(raw.style) ? raw.style : undefined;
  const out: InfinityEdge = {
    enabled: raw.enabled !== false,
  };
  if (Array.isArray(raw.weirs)) {
    out.weirs = raw.weirs
      .filter(
        (w) =>
          w &&
          typeof w === "object" &&
          typeof w.edgeIndex === "number" &&
          Number.isFinite(w.edgeIndex),
      )
      .map((w) => {
        const weir: InfinityEdgeWeir = {
          edgeIndex: Math.max(0, Math.floor(w.edgeIndex)),
        };
        if (w.enabled === false) weir.enabled = false;
        else if (w.enabled === true) weir.enabled = true;
        if (w.widthMm != null) {
          weir.widthMm = clampFinite(w.widthMm, 24 * IN, 50, 50_000);
        }
        if (w.offsetMm != null) {
          weir.offsetMm = clampFinite(w.offsetMm, 0, -20_000, 20_000);
        }
        return weir;
      });
  }
  if (raw.notchDepthMm != null) {
    out.notchDepthMm = clampFinite(raw.notchDepthMm, 1.5 * IN, 5, 600);
  }
  if (style) out.style = style;
  if (raw.scupperCount != null) {
    out.scupperCount = Math.round(clampFinite(raw.scupperCount, 3, 2, 8));
  }
  if (raw.scupperGapMm != null) {
    out.scupperGapMm = clampFinite(raw.scupperGapMm, 4 * IN, 10, 2000);
  }
  if (raw.trough && typeof raw.trough === "object") {
    const trough: InfinityTrough = {};
    if (raw.trough.widthMm != null) {
      trough.widthMm = clampFinite(raw.trough.widthMm, 24 * IN, 100, 3000);
    }
    if (raw.trough.depthMm != null) {
      trough.depthMm = clampFinite(raw.trough.depthMm, 30 * IN, 150, 3000);
    }
    if (raw.trough.waterDepthMm != null) {
      trough.waterDepthMm = clampFinite(
        raw.trough.waterDepthMm,
        18 * IN,
        50,
        2500,
      );
    }
    if (Object.keys(trough).length) out.trough = trough;
  }
  if (raw.designHeadIn != null) {
    out.designHeadIn = clampFinite(raw.designHeadIn, 0.25, 0.0625, 6);
  }
  if (raw.endContractions != null) {
    out.endContractions = Math.round(clampFinite(raw.endContractions, 2, 0, 8));
  }
  if (raw.surgeDisplacementIn != null) {
    out.surgeDisplacementIn = clampFinite(
      raw.surgeDisplacementIn,
      2,
      0.5,
      12,
    );
  }
  if (raw.staticLiftMm != null) {
    out.staticLiftMm = clampFinite(raw.staticLiftMm, 600, 0, 20_000);
  }
  if (raw.pipeRunMm != null) {
    out.pipeRunMm = clampFinite(raw.pipeRunMm, 60 * 304.8, 1000, 200_000);
  }
  if (raw.suctionPipeIdIn != null) {
    out.suctionPipeIdIn = clampFinite(raw.suctionPipeIdIn, 2, 1, 12);
  }
  if (raw.returnPipeIdIn != null) {
    out.returnPipeIdIn = clampFinite(raw.returnPipeIdIn, 2, 1, 12);
  }
  if (raw.flowGpmOverride != null) {
    out.flowGpmOverride = clampFinite(raw.flowGpmOverride, 0, 0, 5000);
  }
  if (raw.surgeGalOverride != null) {
    out.surgeGalOverride = clampFinite(raw.surgeGalOverride, 0, 0, 50_000);
  }
  if (raw.enabled === false) out.enabled = false;
  return out;
}

function normalizeFences(fences: FenceRun[] | undefined): FenceRun[] {
  if (!Array.isArray(fences)) return [];
  return fences
    .filter(
      (f) =>
        f &&
        typeof f.id === "string" &&
        Array.isArray(f.points) &&
        f.points.length >= 2,
    )
    .map((f) => {
      const kind = isFenceKind(f.kind) ? f.kind : "aluminum";
      const heightMm =
        typeof f.heightMm === "number" &&
        Number.isFinite(f.heightMm) &&
        f.heightMm > 0
          ? f.heightMm
          : defaultFenceHeightMm(kind);
      const finish = resolveFenceFinish(kind, f.finishId);
      const gates = normalizeFenceGates(f.gates, f.points.length, heightMm);
      return {
        ...f,
        kind,
        name: typeof f.name === "string" && f.name.trim() ? f.name : "Fence",
        heightMm,
        finishId: finish.id,
        gates,
      };
    });
}

function normalizeFenceGates(
  gates: FenceGate[] | undefined,
  pointCount: number,
  fenceHeightMm: number,
): FenceGate[] {
  if (!Array.isArray(gates) || pointCount < 2) return [];
  const maxEdge = pointCount - 2;
  return gates
    .filter((g) => g && typeof g.id === "string")
    .map((g) => {
      const kind = isGateKind(g.kind) ? g.kind : "swing";
      const defaults = defaultGateSize(kind);
      const widthMm =
        typeof g.widthMm === "number" &&
        Number.isFinite(g.widthMm) &&
        g.widthMm > 0
          ? g.widthMm
          : defaults.widthMm;
      const heightMm =
        typeof g.heightMm === "number" &&
        Number.isFinite(g.heightMm) &&
        g.heightMm > 0
          ? g.heightMm
          : fenceHeightMm;
      return {
        ...g,
        kind,
        edgeIndex: Math.min(maxEdge, Math.max(0, g.edgeIndex | 0)),
        t: Math.min(1, Math.max(0, g.t ?? 0.5)),
        widthMm,
        heightMm,
        finishId:
          g.finishId && isFenceFinishId(g.finishId)
            ? g.finishId
            : undefined,
      };
    });
}

function normalizeGradeSamples(
  samples: GradeSample[] | undefined,
): GradeSample[] {
  if (!Array.isArray(samples)) return [];
  return samples
    .filter(
      (s) =>
        s &&
        typeof s.id === "string" &&
        s.position &&
        typeof s.position.x === "number" &&
        typeof s.position.y === "number" &&
        typeof s.dropMm === "number" &&
        Number.isFinite(s.dropMm),
    )
    .map((s) => ({
      id: s.id,
      position: { x: s.position.x, y: s.position.y },
      dropMm: s.dropMm,
      rotationDeg:
        typeof s.rotationDeg === "number" && Number.isFinite(s.rotationDeg)
          ? ((s.rotationDeg % 360) + 360) % 360
          : 0,
    }));
}

function normalizeGradeOptions(
  options: DesignGradeOptions | undefined,
): DesignGradeOptions {
  const trigger = options?.retainingTriggerMm;
  return {
    retainingTriggerMm:
      typeof trigger === "number" && Number.isFinite(trigger) && trigger > 0
        ? trigger
        : DEFAULT_RETAINING_TRIGGER_MM,
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
