import { createContext, useContext } from "react";
import { sunWorldDir } from "@pool-design/shared";

export type TimeOfDay = "day" | "sunset" | "night";

/** How much to boost niche / bubbler LEDs for the current sky. */
export function ledBoostForTimeOfDay(tod: TimeOfDay): number {
  if (tod === "night") return 1.85;
  if (tod === "sunset") return 1.25;
  return 1;
}

export const TimeOfDayContext = createContext<TimeOfDay>("day");

export function useTimeOfDay(): TimeOfDay {
  return useContext(TimeOfDayContext);
}

export type TimeOfDayPreset = {
  id: TimeOfDay;
  label: string;
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
   * Azimuth is clockwise from true north (180 = south, 270 = west).
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
  day: {
    id: "day",
    label: "Day",
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
    sunElevationDeg: 52,
    sunDistance: 70,
    sun: { intensity: 1.15, color: "#fff5e6" },
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
  sunset: {
    id: "sunset",
    label: "Sunset",
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
    sunElevationDeg: 8,
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

export const TIME_OF_DAY_ORDER: TimeOfDay[] = ["day", "sunset", "night"];
