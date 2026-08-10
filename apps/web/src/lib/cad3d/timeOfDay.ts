import { createContext, useContext } from "react";

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
  sunPosition: [number, number, number];
  sky: {
    turbidity: number;
    rayleigh: number;
    mieCoefficient: number;
    mieDirectionalG: number;
  };
  ambient: number;
  sun: {
    position: [number, number, number];
    intensity: number;
    color: string;
  };
  fill: {
    position: [number, number, number];
    intensity: number;
    color: string;
  };
  hemi: { sky: string; ground: string; intensity: number };
  env: {
    top: string;
    mid: string;
    bot: string;
    sunDir: [number, number, number];
    sunColor: [number, number, number];
    sunStrength: number;
    glowStrength: number;
  };
  exposure: number;
};

export const TIME_OF_DAY_PRESETS: Record<TimeOfDay, TimeOfDayPreset> = {
  day: {
    id: "day",
    label: "Day",
    background: "#b9c9d4",
    fog: "#b9c9d4",
    fogNear: 65,
    fogFar: 160,
    showSky: true,
    sunPosition: [60, 30, 40],
    sky: {
      turbidity: 8,
      rayleigh: 0.8,
      mieCoefficient: 0.005,
      mieDirectionalG: 0.7,
    },
    ambient: 0.55,
    sun: { position: [40, 50, 20], intensity: 1.15, color: "#fff5e6" },
    fill: { position: [-25, 18, -30], intensity: 0.3, color: "#d0e4ff" },
    hemi: { sky: "#dceaf2", ground: "#6b7a6e", intensity: 0.5 },
    env: {
      top: "#8ec4eb",
      mid: "#c5dced",
      bot: "#7a8f6e",
      sunDir: [0.55, 0.62, 0.35],
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
    sunPosition: [85, 3.5, -28],
    sky: {
      turbidity: 14,
      rayleigh: 2.4,
      mieCoefficient: 0.012,
      mieDirectionalG: 0.88,
    },
    ambient: 0.26,
    sun: { position: [55, 5, -30], intensity: 1.4, color: "#ff7a3a" },
    fill: { position: [-28, 10, 22], intensity: 0.28, color: "#6a78a8" },
    hemi: { sky: "#f0a070", ground: "#3a2824", intensity: 0.42 },
    env: {
      top: "#2a3a68",
      mid: "#e88858",
      bot: "#4a2c28",
      sunDir: [0.78, 0.1, -0.38],
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
    sunPosition: [10, -40, 20],
    sky: {
      turbidity: 1,
      rayleigh: 0.1,
      mieCoefficient: 0.001,
      mieDirectionalG: 0.7,
    },
    ambient: 0.06,
    // Soft moonlight so forms still read; pool LEDs carry the drama.
    sun: { position: [25, 55, -15], intensity: 0.12, color: "#a8c0e8" },
    fill: { position: [-20, 8, -25], intensity: 0.04, color: "#304060" },
    hemi: { sky: "#152238", ground: "#060a10", intensity: 0.18 },
    env: {
      top: "#050a14",
      mid: "#101c30",
      bot: "#06080c",
      sunDir: [0.25, 0.9, -0.2],
      sunColor: [0.65, 0.75, 1.0],
      sunStrength: 0.55,
      glowStrength: 0.15,
    },
    exposure: 0.85,
  },
};

export const TIME_OF_DAY_ORDER: TimeOfDay[] = ["day", "sunset", "night"];
