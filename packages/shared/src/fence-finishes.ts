/**
 * Fence / gate color finishes. Stored on FenceRun.finishId (and optionally
 * FenceGate.finishId for overrides).
 */

import type { FenceKind } from "./design-model";

export type FenceFinishColor = { r: number; g: number; b: number };

export type FenceFinish = {
  id: string;
  name: string;
  /** Fence kinds this finish applies to. */
  kinds: FenceKind[];
  colorName: string;
  color: FenceFinishColor;
  description?: string;
};

export const DEFAULT_FENCE_FINISH_BY_KIND: Record<FenceKind, string> = {
  aluminum: "fence_aluminum_black",
  wood: "fence_wood_cedar",
  vinyl: "fence_vinyl_white",
  wrought_iron: "fence_iron_black",
  chain_link: "fence_chain_galvanized",
  glass: "fence_glass_clear",
};

const rgb = (r: number, g: number, b: number): FenceFinishColor => ({
  r,
  g,
  b,
});

export const FENCE_FINISHES: FenceFinish[] = [
  // Aluminum
  {
    id: "fence_aluminum_black",
    name: "Aluminum — black",
    kinds: ["aluminum"],
    colorName: "Black",
    color: rgb(32, 32, 34),
    description: "Powder-coated black aluminum",
  },
  {
    id: "fence_aluminum_bronze",
    name: "Aluminum — bronze",
    kinds: ["aluminum"],
    colorName: "Bronze",
    color: rgb(78, 58, 42),
  },
  {
    id: "fence_aluminum_white",
    name: "Aluminum — white",
    kinds: ["aluminum"],
    colorName: "White",
    color: rgb(236, 234, 228),
  },
  {
    id: "fence_aluminum_silver",
    name: "Aluminum — silver",
    kinds: ["aluminum"],
    colorName: "Silver",
    color: rgb(168, 172, 176),
  },
  // Wood
  {
    id: "fence_wood_cedar",
    name: "Wood — cedar",
    kinds: ["wood"],
    colorName: "Cedar",
    color: rgb(168, 112, 72),
    description: "Natural cedar stain",
  },
  {
    id: "fence_wood_redwood",
    name: "Wood — redwood",
    kinds: ["wood"],
    colorName: "Redwood",
    color: rgb(148, 78, 58),
  },
  {
    id: "fence_wood_walnut",
    name: "Wood — walnut",
    kinds: ["wood"],
    colorName: "Walnut",
    color: rgb(92, 62, 42),
  },
  {
    id: "fence_wood_whitewash",
    name: "Wood — whitewash",
    kinds: ["wood"],
    colorName: "Whitewash",
    color: rgb(214, 206, 190),
  },
  // Vinyl
  {
    id: "fence_vinyl_white",
    name: "Vinyl — white",
    kinds: ["vinyl"],
    colorName: "White",
    color: rgb(242, 242, 238),
  },
  {
    id: "fence_vinyl_tan",
    name: "Vinyl — tan",
    kinds: ["vinyl"],
    colorName: "Tan",
    color: rgb(210, 190, 158),
  },
  {
    id: "fence_vinyl_gray",
    name: "Vinyl — gray",
    kinds: ["vinyl"],
    colorName: "Gray",
    color: rgb(156, 158, 160),
  },
  // Wrought iron
  {
    id: "fence_iron_black",
    name: "Wrought iron — black",
    kinds: ["wrought_iron"],
    colorName: "Black",
    color: rgb(28, 28, 30),
  },
  {
    id: "fence_iron_bronze",
    name: "Wrought iron — bronze",
    kinds: ["wrought_iron"],
    colorName: "Bronze",
    color: rgb(72, 54, 40),
  },
  // Chain link
  {
    id: "fence_chain_galvanized",
    name: "Chain link — galvanized",
    kinds: ["chain_link"],
    colorName: "Galvanized",
    color: rgb(168, 172, 170),
  },
  {
    id: "fence_chain_black",
    name: "Chain link — black",
    kinds: ["chain_link"],
    colorName: "Black",
    color: rgb(48, 48, 50),
  },
  {
    id: "fence_chain_green",
    name: "Chain link — green",
    kinds: ["chain_link"],
    colorName: "Green",
    color: rgb(62, 92, 58),
  },
  // Glass
  {
    id: "fence_glass_clear",
    name: "Glass — clear",
    kinds: ["glass"],
    colorName: "Clear",
    color: rgb(186, 210, 222),
    description: "Clear tempered glass panels",
  },
  {
    id: "fence_glass_frosted",
    name: "Glass — frosted",
    kinds: ["glass"],
    colorName: "Frosted",
    color: rgb(210, 216, 220),
  },
  {
    id: "fence_glass_tinted",
    name: "Glass — tinted bronze",
    kinds: ["glass"],
    colorName: "Tinted",
    color: rgb(120, 118, 108),
  },
];

const BY_ID = new Map(FENCE_FINISHES.map((f) => [f.id, f]));

export function isFenceFinishId(id: string | undefined | null): boolean {
  return typeof id === "string" && BY_ID.has(id);
}

export function getFenceFinish(id: string): FenceFinish {
  return BY_ID.get(id) ?? FENCE_FINISHES[0];
}

export function defaultFenceFinishId(kind: FenceKind): string {
  return DEFAULT_FENCE_FINISH_BY_KIND[kind];
}

export function resolveFenceFinish(
  kind: FenceKind,
  finishId?: string | null,
): FenceFinish {
  if (finishId && isFenceFinishId(finishId)) {
    const finish = getFenceFinish(finishId);
    if (finish.kinds.includes(kind)) return finish;
  }
  return getFenceFinish(defaultFenceFinishId(kind));
}

export function fenceFinishesForKind(kind: FenceKind): FenceFinish[] {
  return FENCE_FINISHES.filter((f) => f.kinds.includes(kind));
}

export function fenceFinishCssColor(finish: FenceFinish): string {
  const { r, g, b } = finish.color;
  return `rgb(${r}, ${g}, ${b})`;
}

export function fenceFinishHex(finish: FenceFinish): string {
  const { r, g, b } = finish.color;
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}
