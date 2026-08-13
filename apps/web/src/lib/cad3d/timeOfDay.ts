import { createContext, useContext } from "react";
import { sunWorldDir } from "@pool-design/shared";

export type TimeOfDay =
  | "sunrise"
  | "morning"
  | "noon"
  | "afternoon"
  | "evening"
  | "sunset"
  | "night";

export function isNightTime(tod: TimeOfDay): boolean {
  return tod === "night";
}

/** Sunrise / evening / sunset — warmer sky, pool LEDs start to read. */
export function isGoldenHour(tod: TimeOfDay): boolean {
  return tod === "sunrise" || tod === "evening" || tod === "sunset";
}

/** How much to boost niche / bubbler LEDs for the current sky. */
export function ledBoostForTimeOfDay(tod: TimeOfDay): number {
  if (tod === "night") return 1.85;
  if (tod === "sunset" || tod === "sunrise") return 1.3;
  if (tod === "evening") return 1.18;
  return 1;
}

export const TimeOfDayContext = createContext<TimeOfDay>("noon");

export function useTimeOfDay(): TimeOfDay {
  return useContext(TimeOfDayContext);
}

export type TimeOfDayPreset = {
  id: TimeOfDay;
  label: string;
  /** Longer hint for the toolbar tooltip */
  hint: string;
  background: string;
  fog: string;
  fogNear: number;
  fogFar: number;
  /** When false, skip drei Sky (pure night backdrop). */
  showSky: boolean;
  sky: {
    turbidity: number;
    rayleigh: number;
    mieCoefficient: number;
    mieDirectionalG: number;
  };
  ambient: number;
  /**
   * Compass-relative sun / moon.
   * Azimuth is clockwise from true north (90 = east, 180 = south, 270 = west).
   * Northern-hemisphere default — not a solar-ephemeris.
   */
  sunAzimuthDeg: number;
  sunElevationDeg: number;
  sunDistance: number;
  sun: {
    intensity: number;
    color: string;
  };
  fillAzimuthDeg: number;
  fillElevationDeg: number;
  fillDistance: number;
  fill: {
    intensity: number;
    color: string;
  };
  hemi: { sky: string; ground: string; intensity: number };
  env: {
    top: string;
    mid: string;
    bot: string;
    sunColor: [number, number, number];
    sunStrength: number;
    glowStrength: number;
  };
  exposure: number;
};

export type OrientedLighting = {
  sunPosition: [number, number, number];
  sunWorld: [number, number, number];
  fillWorld: [number, number, number];
  sunDir: [number, number, number];
};

function offsetFromCenter(
  dir: { x: number; y: number; z: number },
  distance: number,
  center: { x: number; z: number },
): [number, number, number] {
  return [
    center.x + dir.x * distance,
    dir.y * distance,
    center.z + dir.z * distance,
  ];
}

/** Place sun, fill, sky, and env vectors for the site's true north. */
export function lightingForNorth(
  preset: TimeOfDayPreset,
  northDeg: number,
  center: { x: number; z: number } = { x: 0, z: 0 },
): OrientedLighting {
  const sun = sunWorldDir(
    preset.sunAzimuthDeg,
    preset.sunElevationDeg,
    northDeg,
  );
  const fill = sunWorldDir(
    preset.fillAzimuthDeg,
    preset.fillElevationDeg,
    northDeg,
  );
  const skyScale = 100;
  return {
    sunPosition: [sun.x * skyScale, sun.y * skyScale, sun.z * skyScale],
    sunWorld: offsetFromCenter(sun, preset.sunDistance, center),
    fillWorld: offsetFromCenter(fill, preset.fillDistance, center),
    sunDir: [sun.x, sun.y, sun.z],
  };
}

export const TIME_OF_DAY_PRESETS: Record<TimeOfDay, TimeOfDayPreset> = {
  sunrise: {
    id: "sunrise",
    label: "Sunrise",
    hint: "Low sun from the east",
    background: "#d4a090",
    fog: "#c89888",
    fogNear: 50,
    fogFar: 130,
    showSky: true,
    sky: {
      turbidity: 12,
      rayleigh: 2.2,
      mieCoefficient: 0.01,
      mieDirectionalG: 0.82,
    },
    ambient: 0.28,
    sunAzimuthDeg: 90,
    sunElevationDeg: 5,
    sunDistance: 80,
    sun: { intensity: 1.25, color: "#ff8a62" },
    fillAzimuthDeg: 270,
    fillElevationDeg: 14,
    fillDistance: 40,
    fill: { intensity: 0.26, color: "#6a78a8" },
    hemi: { sky: "#f0a088", ground: "#3a2824", intensity: 0.4 },
    env: {
      top: "#3a4a78",
      mid: "#e89078",
      bot: "#4a3028",
      sunColor: [1.0, 0.58, 0.38],
      sunStrength: 3.4,
      glowStrength: 0.8,
    },
    exposure: 0.95,
  },
  morning: {
    id: "morning",
    label: "Morning",
    hint: "Mid-morning sun from the southeast",
    background: "#c5d4e0",
    fog: "#c5d4e0",
    fogNear: 60,
    fogFar: 150,
    showSky: true,
    sky: {
      turbidity: 6,
      rayleigh: 1.1,
      mieCoefficient: 0.004,
      mieDirectionalG: 0.72,
    },
    ambient: 0.48,
    sunAzimuthDeg: 130,
    sunElevationDeg: 38,
    sunDistance: 72,
    sun: { intensity: 1.12, color: "#fff4e4" },
    fillAzimuthDeg: 310,
    fillElevationDeg: 22,
    fillDistance: 44,
    fill: { intensity: 0.28, color: "#c8d8f0" },
    hemi: { sky: "#d4e6f4", ground: "#6b7a6e", intensity: 0.48 },
    env: {
      top: "#7eb6e4",
      mid: "#c8dcec",
      bot: "#7a8f6e",
      sunColor: [1.0, 0.95, 0.86],
      sunStrength: 2.0,
      glowStrength: 0.32,
    },
    exposure: 1,
  },
  noon: {
    id: "noon",
    label: "Noon",
    hint: "High sun from the south",
    background: "#b9c9d4",
    fog: "#b9c9d4",
    fogNear: 65,
    fogFar: 160,
    showSky: true,
    sky: {
      turbidity: 8,
      rayleigh: 0.8,
      mieCoefficient: 0.005,
      mieDirectionalG: 0.7,
    },
    ambient: 0.55,
    sunAzimuthDeg: 180,
    sunElevationDeg: 58,
    sunDistance: 70,
    sun: { intensity: 1.18, color: "#fff5e6" },
    fillAzimuthDeg: 20,
    fillElevationDeg: 28,
    fillDistance: 45,
    fill: { intensity: 0.3, color: "#d0e4ff" },
    hemi: { sky: "#dceaf2", ground: "#6b7a6e", intensity: 0.5 },
    env: {
      top: "#8ec4eb",
      mid: "#c5dced",
      bot: "#7a8f6e",
      sunColor: [1.0, 0.96, 0.88],
      sunStrength: 2.2,
      glowStrength: 0.35,
    },
    exposure: 1,
  },
  afternoon: {
    id: "afternoon",
    label: "Afternoon",
    hint: "Mid-afternoon sun from the southwest",
    background: "#c4c8c4",
    fog: "#c8c4b8",
    fogNear: 60,
    fogFar: 150,
    showSky: true,
    sky: {
      turbidity: 7,
      rayleigh: 1.0,
      mieCoefficient: 0.006,
      mieDirectionalG: 0.74,
    },
    ambient: 0.5,
    sunAzimuthDeg: 230,
    sunElevationDeg: 38,
    sunDistance: 72,
    sun: { intensity: 1.14, color: "#ffe8c8" },
    fillAzimuthDeg: 50,
    fillElevationDeg: 22,
    fillDistance: 44,
    fill: { intensity: 0.28, color: "#c8d4e8" },
    hemi: { sky: "#e8dcc8", ground: "#6a6e62", intensity: 0.48 },
    env: {
      top: "#7aa8d0",
      mid: "#e0d4c0",
      bot: "#7a8a68",
      sunColor: [1.0, 0.9, 0.72],
      sunStrength: 2.3,
      glowStrength: 0.4,
    },
    exposure: 1,
  },
  evening: {
    id: "evening",
    label: "Evening",
    hint: "Golden hour, sun still up in the west",
    background: "#d4a070",
    fog: "#c89868",
    fogNear: 52,
    fogFar: 135,
    showSky: true,
    sky: {
      turbidity: 11,
      rayleigh: 1.8,
      mieCoefficient: 0.01,
      mieDirectionalG: 0.84,
    },
    ambient: 0.34,
    sunAzimuthDeg: 255,
    sunElevationDeg: 16,
    sunDistance: 78,
    sun: { intensity: 1.32, color: "#ff9a48" },
    fillAzimuthDeg: 80,
    fillElevationDeg: 16,
    fillDistance: 42,
    fill: { intensity: 0.26, color: "#7888b0" },
    hemi: { sky: "#f0b078", ground: "#3a3024", intensity: 0.44 },
    env: {
      top: "#3a5080",
      mid: "#f0a060",
      bot: "#4a3428",
      sunColor: [1.0, 0.62, 0.32],
      sunStrength: 3.2,
      glowStrength: 0.72,
    },
    exposure: 0.97,
  },
  sunset: {
    id: "sunset",
    label: "Sunset",
    hint: "Sun on the western horizon",
    background: "#c07858",
    fog: "#b06850",
    fogNear: 48,
    fogFar: 125,
    showSky: true,
    sky: {
      turbidity: 14,
      rayleigh: 2.4,
      mieCoefficient: 0.012,
      mieDirectionalG: 0.88,
    },
    ambient: 0.26,
    sunAzimuthDeg: 270,
    sunElevationDeg: 6,
    sunDistance: 80,
    sun: { intensity: 1.4, color: "#ff7a3a" },
    fillAzimuthDeg: 90,
    fillElevationDeg: 16,
    fillDistance: 40,
    fill: { intensity: 0.28, color: "#6a78a8" },
    hemi: { sky: "#f0a070", ground: "#3a2824", intensity: 0.42 },
    env: {
      top: "#2a3a68",
      mid: "#e88858",
      bot: "#4a2c28",
      sunColor: [1.0, 0.55, 0.28],
      sunStrength: 3.8,
      glowStrength: 0.85,
    },
    exposure: 0.95,
  },
  night: {
    id: "night",
    label: "Night",
    hint: "Moonlight; pool LEDs carry the scene",
    background: "#070d18",
    fog: "#0a1220",
    fogNear: 35,
    fogFar: 100,
    showSky: false,
    sky: {
      turbidity: 1,
      rayleigh: 0.1,
      mieCoefficient: 0.001,
      mieDirectionalG: 0.7,
    },
    ambient: 0.06,
    sunAzimuthDeg: 150,
    sunElevationDeg: 62,
    sunDistance: 70,
    sun: { intensity: 0.12, color: "#a8c0e8" },
    fillAzimuthDeg: 330,
    fillElevationDeg: 18,
    fillDistance: 40,
    fill: { intensity: 0.04, color: "#304060" },
    hemi: { sky: "#152238", ground: "#060a10", intensity: 0.18 },
    env: {
      top: "#050a14",
      mid: "#101c30",
      bot: "#06080c",
      sunColor: [0.65, 0.75, 1.0],
      sunStrength: 0.55,
      glowStrength: 0.15,
    },
    exposure: 0.85,
  },
};

export const TIME_OF_DAY_ORDER: TimeOfDay[] = [
  "sunrise",
  "morning",
  "noon",
  "afternoon",
  "evening",
  "sunset",
  "night",
];
