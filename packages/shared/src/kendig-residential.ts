import { DESIGN_LEVEL_CONFIG } from "./design-level";
import {
  DEFAULT_FENCE_HEIGHT_MM,
  DEFAULT_POOL_WALL_THICKNESS_MM,
  DEFAULT_SLIDING_DOOR_HEIGHT_MM,
  DEFAULT_SLIDING_DOOR_WIDTH_MM,
  DEFAULT_SPA_SHELL_HEIGHT_MM,
  DEFAULT_SPA_WALL_THICKNESS_MM,
  DEFAULT_WINDOW_HEIGHT_MM,
  DEFAULT_WINDOW_WIDTH_MM,
  emptyDesignDocument,
  type DesignDocument,
  type PlacedObject,
  type PointMm,
} from "./design-model";
import { getPlaceableItem } from "./object-library";

const FT = 304.8;

function rect(x: number, y: number, w: number, h: number): PointMm[] {
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ];
}

function place(
  catalogItemId: string,
  x: number,
  y: number,
  rotationDeg = 0,
): PlacedObject {
  const item = getPlaceableItem(catalogItemId);
  if (!item) {
    throw new Error(`Unknown placeable ${catalogItemId}`);
  }
  return {
    id: `kendig_${catalogItemId}_${Math.round(x)}_${Math.round(y)}`,
    catalogItemId,
    name: item.name,
    position: { x, y },
    rotationDeg,
    layerId: item.layerId,
    widthMm: item.widthMm,
    depthMm: item.depthMm,
    heightMm: item.heightMm,
  };
}

/**
 * Complete Tampa residential backyard for sales demos (seeded as Kendig Residence Pool).
 */
export function kendigResidentialDesign(): DesignDocument {
  const design = emptyDesignDocument(
    "residential",
    "imperial",
    DESIGN_LEVEL_CONFIG.residential.defaultLayers,
  );

  const houseX = 8 * FT;
  const houseY = 4 * FT;
  const houseW = 48 * FT;
  const houseH = 30 * FT;
  const poolX = 18 * FT;
  const poolY = 44 * FT;
  const poolW = 16 * FT;
  const poolH = 34 * FT;
  const spaW = 10 * FT;
  const spaH = 10 * FT;
  const spaX = poolX + 3 * FT;
  const spaY = poolY - spaH;

  design.buildings = [
    {
      id: "kendig_house",
      name: "Residence",
      kind: "house",
      outline: rect(houseX, houseY, houseW, houseH),
      stories: 1,
      exteriorFinishId: "house_white",
      exteriorSidingId: "stucco",
      openings: [
        {
          id: "kendig_slider",
          kind: "sliding_door",
          edgeIndex: 2,
          t: 0.45,
          widthMm: DEFAULT_SLIDING_DOOR_WIDTH_MM,
          heightMm: DEFAULT_SLIDING_DOOR_HEIGHT_MM,
          story: 1,
          sillAboveFloorMm: 0,
        },
        {
          id: "kendig_window_e",
          kind: "window",
          edgeIndex: 1,
          t: 0.4,
          widthMm: DEFAULT_WINDOW_WIDTH_MM,
          heightMm: DEFAULT_WINDOW_HEIGHT_MM,
          story: 1,
        },
        {
          id: "kendig_window_w",
          kind: "window",
          edgeIndex: 3,
          t: 0.55,
          widthMm: DEFAULT_WINDOW_WIDTH_MM,
          heightMm: DEFAULT_WINDOW_HEIGHT_MM,
          story: 1,
        },
      ],
    },
  ];

  design.poolBodies = [
    {
      id: "kendig_pool",
      name: "Pool",
      kind: "pool",
      outline: rect(poolX, poolY, poolW, poolH),
      depthShallowMm: 3.5 * FT,
      depthDeepMm: 8 * FT,
      wallThicknessMm: DEFAULT_POOL_WALL_THICKNESS_MM,
      waterlineTileId: "wl_porcelain_ivory",
    },
    {
      id: "kendig_spa",
      name: "Spa",
      kind: "spa",
      outline: rect(spaX, spaY, spaW, spaH),
      depthShallowMm: 3.5 * FT,
      depthDeepMm: 3.5 * FT,
      wallThicknessMm: DEFAULT_SPA_WALL_THICKNESS_MM,
      shellHeightMm: DEFAULT_SPA_SHELL_HEIGHT_MM,
      waterlineTileId: "wl_porcelain_ivory",
      spillover: {
        enabled: true,
        targetPoolId: "kendig_pool",
        join: "raised_spillover",
        style: "sheet",
      },
    },
  ];

  design.patios = [
    {
      id: "kendig_patio",
      name: "Travertine deck",
      outline: rect(10 * FT, 34 * FT, 40 * FT, 52 * FT),
      materialId: "stone_travertine_ivory",
      gradeStrategy: "both",
    },
  ];

  design.features = [
    {
      id: "kendig_steps",
      kind: "steps",
      name: "Entry steps",
      poolBodyId: "kendig_pool",
      outline: rect(poolX + 4 * FT, poolY, 8 * FT, 4 * FT),
      riserCount: 4,
    },
  ];

  const pad = place("equip_pad", 42 * FT, 58 * FT, 0);
  design.objects = [
    pad,
    place("pump_variable_speed", 40.5 * FT, 57 * FT, 0),
    place("filter_cartridge", 42 * FT, 57.2 * FT, 0),
    place("heater_gas", 43.8 * FT, 57.5 * FT, 0),
    place("salt_chlorinator", 41.2 * FT, 59.2 * FT, 0),
    place("lounge_chair", 14 * FT, 50 * FT, 90),
    place("lounge_chair", 14 * FT, 58 * FT, 90),
    place("sabal_palmetto", 12 * FT, 86 * FT, 0),
    place("sabal_palmetto", 48 * FT, 86 * FT, 0),
    place("areca_palm", 46 * FT, 42 * FT, 0),
    place("clusia", 11 * FT, 38 * FT, 0),
    place("firebush", 49 * FT, 48 * FT, 0),
    place("foxtail_palm", 8 * FT, 70 * FT, 0),
  ];

  design.fences = [
    {
      id: "kendig_fence",
      name: "Yard fence",
      kind: "aluminum",
      finishId: "fence_aluminum_black",
      heightMm: DEFAULT_FENCE_HEIGHT_MM,
      points: [
        { x: 4 * FT, y: 34 * FT },
        { x: 4 * FT, y: 96 * FT },
        { x: 56 * FT, y: 96 * FT },
        { x: 56 * FT, y: 34 * FT },
      ],
      gates: [
        {
          id: "kendig_gate",
          kind: "swing",
          edgeIndex: 2,
          t: 0.15,
          widthMm: 914.4,
        },
      ],
    },
  ];

  design.northDeg = 0;
  return design;
}
