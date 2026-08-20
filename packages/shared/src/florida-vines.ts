/**
 * Florida landscape vines for flowering trellises.
 * Stored on PlacedObject.vineId.
 *
 * Invasives (cat's claw, air potato, skunk vine) are omitted on purpose.
 */

export type VineColor = { r: number; g: number; b: number };

export type VineGroup =
  | "bougainvillea"
  | "native"
  | "jasmine"
  | "passionflower"
  | "tropical"
  | "foliage";

export type FloridaVine = {
  id: string;
  name: string;
  botanical: string;
  group: VineGroup;
  bloomName: string;
  flower: VineColor;
  foliage: VineColor;
  /** 0–1, how much of the lattice is covered in leaf. */
  leafDensity: number;
  /** Relative flower / bract size. */
  flowerSize: number;
  native?: boolean;
  description?: string;
};

const rgb = (r: number, g: number, b: number): VineColor => ({ r, g, b });

export const VINE_GROUP_LABELS: Record<VineGroup, string> = {
  bougainvillea: "Bougainvillea",
  native: "Florida native",
  jasmine: "Jasmine & fragrant",
  passionflower: "Passionflower",
  tropical: "Tropical flowering",
  foliage: "Foliage / wall cover",
};

export const VINE_GROUPS: VineGroup[] = [
  "bougainvillea",
  "native",
  "jasmine",
  "passionflower",
  "tropical",
  "foliage",
];

export const DEFAULT_VINE_ID = "bougainvillea_magenta";

export const FLORIDA_VINES: FloridaVine[] = [
  {
    id: "bougainvillea_magenta",
    name: "Bougainvillea",
    botanical: "Bougainvillea glabra",
    group: "bougainvillea",
    bloomName: "Magenta",
    flower: rgb(196, 28, 92),
    foliage: rgb(46, 92, 48),
    leafDensity: 0.55,
    flowerSize: 1.35,
    description: "The classic Florida trellis — paper bracts, heat-loving",
  },
  {
    id: "bougainvillea_pink",
    name: "Bougainvillea",
    botanical: "Bougainvillea spectabilis",
    group: "bougainvillea",
    bloomName: "Pink",
    flower: rgb(232, 118, 168),
    foliage: rgb(48, 96, 52),
    leafDensity: 0.55,
    flowerSize: 1.3,
  },
  {
    id: "bougainvillea_white",
    name: "Bougainvillea",
    botanical: "Bougainvillea glabra",
    group: "bougainvillea",
    bloomName: "White",
    flower: rgb(244, 242, 236),
    foliage: rgb(52, 102, 56),
    leafDensity: 0.52,
    flowerSize: 1.25,
  },
  {
    id: "bougainvillea_orange",
    name: "Bougainvillea",
    botanical: "Bougainvillea × buttiana",
    group: "bougainvillea",
    bloomName: "Orange",
    flower: rgb(230, 102, 36),
    foliage: rgb(44, 90, 46),
    leafDensity: 0.55,
    flowerSize: 1.3,
  },
  {
    id: "bougainvillea_red",
    name: "Bougainvillea",
    botanical: "Bougainvillea spectabilis",
    group: "bougainvillea",
    bloomName: "Red",
    flower: rgb(186, 32, 38),
    foliage: rgb(42, 88, 46),
    leafDensity: 0.55,
    flowerSize: 1.3,
  },
  {
    id: "bougainvillea_purple",
    name: "Bougainvillea",
    botanical: "Bougainvillea glabra",
    group: "bougainvillea",
    bloomName: "Purple",
    flower: rgb(118, 52, 148),
    foliage: rgb(46, 92, 50),
    leafDensity: 0.55,
    flowerSize: 1.3,
  },
  {
    id: "coral_honeysuckle",
    name: "Coral honeysuckle",
    botanical: "Lonicera sempervirens",
    group: "native",
    bloomName: "Coral",
    flower: rgb(204, 52, 48),
    foliage: rgb(40, 86, 44),
    leafDensity: 0.7,
    flowerSize: 0.85,
    native: true,
    description: "Native trumpet clusters; hummingbirds",
  },
  {
    id: "crossvine",
    name: "Crossvine",
    botanical: "Bignonia capreolata",
    group: "native",
    bloomName: "Orange-red",
    flower: rgb(214, 86, 32),
    foliage: rgb(38, 78, 40),
    leafDensity: 0.72,
    flowerSize: 0.95,
    native: true,
    description: "Native; orange trumpets with a yellow throat",
  },
  {
    id: "carolina_jessamine",
    name: "Carolina jessamine",
    botanical: "Gelsemium sempervirens",
    group: "native",
    bloomName: "Yellow",
    flower: rgb(236, 196, 42),
    foliage: rgb(36, 82, 42),
    leafDensity: 0.78,
    flowerSize: 0.8,
    native: true,
    description: "Native yellow trumpets; all parts toxic if eaten",
  },
  {
    id: "american_wisteria",
    name: "American wisteria",
    botanical: "Wisteria frutescens",
    group: "native",
    bloomName: "Lavender",
    flower: rgb(156, 124, 196),
    foliage: rgb(48, 96, 52),
    leafDensity: 0.68,
    flowerSize: 0.9,
    native: true,
    description: "Native; less aggressive than Asian wisteria",
  },
  {
    id: "trumpet_creeper",
    name: "Trumpet creeper",
    botanical: "Campsis radicans",
    group: "native",
    bloomName: "Orange",
    flower: rgb(220, 78, 28),
    foliage: rgb(44, 92, 46),
    leafDensity: 0.75,
    flowerSize: 1.05,
    native: true,
    description: "Native; vigorous — keep it on a stout trellis",
  },
  {
    id: "confederate_jasmine",
    name: "Confederate jasmine",
    botanical: "Trachelospermum jasminoides",
    group: "jasmine",
    bloomName: "White",
    flower: rgb(246, 246, 240),
    foliage: rgb(32, 78, 42),
    leafDensity: 0.88,
    flowerSize: 0.7,
    description: "Starry white, heavy fragrance; Florida staple",
  },
  {
    id: "arabian_jasmine",
    name: "Arabian jasmine",
    botanical: "Jasminum sambac",
    group: "jasmine",
    bloomName: "White",
    flower: rgb(250, 250, 246),
    foliage: rgb(40, 88, 48),
    leafDensity: 0.7,
    flowerSize: 0.75,
    description: "Can be trained on a trellis; night fragrance",
  },
  {
    id: "downy_jasmine",
    name: "Downy jasmine",
    botanical: "Jasminum multiflorum",
    group: "jasmine",
    bloomName: "White",
    flower: rgb(244, 244, 238),
    foliage: rgb(48, 96, 54),
    leafDensity: 0.72,
    flowerSize: 0.7,
  },
  {
    id: "madagascar_jasmine",
    name: "Madagascar jasmine",
    botanical: "Stephanotis floribunda",
    group: "jasmine",
    bloomName: "White",
    flower: rgb(248, 248, 244),
    foliage: rgb(28, 72, 40),
    leafDensity: 0.65,
    flowerSize: 0.85,
    description: "Waxy white trumpets; likes a warm, bright wall",
  },
  {
    id: "maypop",
    name: "Maypop",
    botanical: "Passiflora incarnata",
    group: "passionflower",
    bloomName: "Lavender",
    flower: rgb(168, 112, 196),
    foliage: rgb(52, 108, 52),
    leafDensity: 0.62,
    flowerSize: 1.15,
    native: true,
    description: "Native passionflower; host for gulf fritillary",
  },
  {
    id: "blue_passionflower",
    name: "Blue passionflower",
    botanical: "Passiflora caerulea",
    group: "passionflower",
    bloomName: "Blue",
    flower: rgb(92, 124, 196),
    foliage: rgb(48, 102, 50),
    leafDensity: 0.6,
    flowerSize: 1.2,
  },
  {
    id: "red_passionflower",
    name: "Red passionflower",
    botanical: "Passiflora vitifolia",
    group: "passionflower",
    bloomName: "Scarlet",
    flower: rgb(196, 28, 36),
    foliage: rgb(44, 98, 48),
    leafDensity: 0.58,
    flowerSize: 1.15,
  },
  {
    id: "passion_fruit",
    name: "Passion fruit",
    botanical: "Passiflora edulis",
    group: "passionflower",
    bloomName: "White-purple",
    flower: rgb(186, 168, 214),
    foliage: rgb(40, 96, 46),
    leafDensity: 0.66,
    flowerSize: 1.1,
    description: "Edible fruit vine for a stout trellis",
  },
  {
    id: "mandevilla_pink",
    name: "Mandevilla",
    botanical: "Mandevilla sanderi",
    group: "tropical",
    bloomName: "Pink",
    flower: rgb(232, 96, 148),
    foliage: rgb(28, 86, 48),
    leafDensity: 0.58,
    flowerSize: 1.2,
    description: "Glossy leaves, large trumpets; patio classic",
  },
  {
    id: "mandevilla_red",
    name: "Mandevilla",
    botanical: "Mandevilla splendens",
    group: "tropical",
    bloomName: "Red",
    flower: rgb(196, 28, 48),
    foliage: rgb(26, 82, 46),
    leafDensity: 0.58,
    flowerSize: 1.2,
  },
  {
    id: "mandevilla_white",
    name: "Mandevilla",
    botanical: "Mandevilla boliviensis",
    group: "tropical",
    bloomName: "White",
    flower: rgb(248, 246, 240),
    foliage: rgb(30, 88, 50),
    leafDensity: 0.56,
    flowerSize: 1.15,
  },
  {
    id: "flame_vine",
    name: "Flame vine",
    botanical: "Pyrostegia venusta",
    group: "tropical",
    bloomName: "Orange",
    flower: rgb(236, 108, 22),
    foliage: rgb(36, 86, 42),
    leafDensity: 0.8,
    flowerSize: 0.9,
    description: "Winter orange sheets on fences and arbors",
  },
  {
    id: "mexican_flame_vine",
    name: "Mexican flame vine",
    botanical: "Pseudogynoxys chenopodioides",
    group: "tropical",
    bloomName: "Orange",
    flower: rgb(232, 92, 28),
    foliage: rgb(50, 102, 48),
    leafDensity: 0.7,
    flowerSize: 0.85,
  },
  {
    id: "queens_wreath",
    name: "Queen's wreath",
    botanical: "Petrea volubilis",
    group: "tropical",
    bloomName: "Violet",
    flower: rgb(92, 72, 168),
    foliage: rgb(58, 92, 52),
    leafDensity: 0.64,
    flowerSize: 0.95,
    description: "Sandpaper vine; long violet racemes",
  },
  {
    id: "allamanda_yellow",
    name: "Allamanda",
    botanical: "Allamanda cathartica",
    group: "tropical",
    bloomName: "Yellow",
    flower: rgb(236, 196, 36),
    foliage: rgb(34, 92, 44),
    leafDensity: 0.62,
    flowerSize: 1.15,
    description: "Golden trumpets; train as a vine",
  },
  {
    id: "allamanda_purple",
    name: "Purple allamanda",
    botanical: "Allamanda blanchetii",
    group: "tropical",
    bloomName: "Mauve",
    flower: rgb(168, 72, 148),
    foliage: rgb(36, 90, 46),
    leafDensity: 0.6,
    flowerSize: 1.1,
  },
  {
    id: "bleeding_heart_vine",
    name: "Bleeding heart vine",
    botanical: "Clerodendrum thomsoniae",
    group: "tropical",
    bloomName: "Red-white",
    flower: rgb(196, 36, 48),
    foliage: rgb(40, 88, 46),
    leafDensity: 0.6,
    flowerSize: 0.9,
  },
  {
    id: "glory_bower",
    name: "Glory bower",
    botanical: "Clerodendrum splendens",
    group: "tropical",
    bloomName: "Scarlet",
    flower: rgb(188, 24, 36),
    foliage: rgb(38, 86, 44),
    leafDensity: 0.66,
    flowerSize: 0.85,
  },
  {
    id: "rangoon_creeper",
    name: "Rangoon creeper",
    botanical: "Combretum indicum",
    group: "tropical",
    bloomName: "Pink-red",
    flower: rgb(214, 72, 96),
    foliage: rgb(42, 94, 48),
    leafDensity: 0.7,
    flowerSize: 0.8,
    description: "Flowers open white, then pink, then red",
  },
  {
    id: "sky_vine",
    name: "Sky vine",
    botanical: "Thunbergia grandiflora",
    group: "tropical",
    bloomName: "Blue",
    flower: rgb(86, 124, 196),
    foliage: rgb(44, 96, 50),
    leafDensity: 0.72,
    flowerSize: 1.1,
    description: "Bengal clock vine; big lavender-blue trumpets",
  },
  {
    id: "black_eyed_susan_vine",
    name: "Black-eyed Susan vine",
    botanical: "Thunbergia alata",
    group: "tropical",
    bloomName: "Orange",
    flower: rgb(228, 148, 28),
    foliage: rgb(48, 104, 52),
    leafDensity: 0.68,
    flowerSize: 0.75,
  },
  {
    id: "coral_vine",
    name: "Coral vine",
    botanical: "Antigonon leptopus",
    group: "tropical",
    bloomName: "Pink",
    flower: rgb(232, 96, 132),
    foliage: rgb(52, 108, 54),
    leafDensity: 0.74,
    flowerSize: 0.7,
    description: "Confederate vine; airy pink sprays",
  },
  {
    id: "moonflower",
    name: "Moonflower",
    botanical: "Ipomoea alba",
    group: "tropical",
    bloomName: "White",
    flower: rgb(250, 250, 246),
    foliage: rgb(36, 90, 44),
    leafDensity: 0.58,
    flowerSize: 1.25,
    description: "Night-blooming white saucers",
  },
  {
    id: "cypress_vine",
    name: "Cypress vine",
    botanical: "Ipomoea quamoclit",
    group: "tropical",
    bloomName: "Scarlet",
    flower: rgb(204, 32, 40),
    foliage: rgb(40, 102, 48),
    leafDensity: 0.55,
    flowerSize: 0.65,
    description: "Fine ferny foliage, starry red blooms",
  },
  {
    id: "blue_dawn_flower",
    name: "Blue dawn flower",
    botanical: "Ipomoea indica",
    group: "tropical",
    bloomName: "Blue",
    flower: rgb(72, 108, 196),
    foliage: rgb(42, 98, 50),
    leafDensity: 0.7,
    flowerSize: 1.05,
  },
  {
    id: "garlic_vine",
    name: "Garlic vine",
    botanical: "Mansoa alliacea",
    group: "tropical",
    bloomName: "Lavender",
    flower: rgb(148, 112, 188),
    foliage: rgb(46, 98, 52),
    leafDensity: 0.68,
    flowerSize: 0.85,
    description: "Crushed leaves smell like garlic",
  },
  {
    id: "bower_vine",
    name: "Bower vine",
    botanical: "Pandorea jasminoides",
    group: "tropical",
    bloomName: "Pink",
    flower: rgb(232, 168, 188),
    foliage: rgb(34, 86, 46),
    leafDensity: 0.66,
    flowerSize: 0.95,
  },
  {
    id: "dutchmans_pipe",
    name: "Dutchman's pipe",
    botanical: "Aristolochia elegans",
    group: "tropical",
    bloomName: "Maroon",
    flower: rgb(128, 48, 64),
    foliage: rgb(36, 92, 44),
    leafDensity: 0.64,
    flowerSize: 1.1,
    description: "Pipe-shaped blooms; swallowtail host",
  },
  {
    id: "butterfly_vine",
    name: "Butterfly vine",
    botanical: "Mascagnia macroptera",
    group: "tropical",
    bloomName: "Yellow",
    flower: rgb(228, 188, 36),
    foliage: rgb(44, 96, 48),
    leafDensity: 0.62,
    flowerSize: 0.8,
    description: "Yellow flowers, winged seed pods",
  },
  {
    id: "chalice_vine",
    name: "Chalice vine",
    botanical: "Solandra maxima",
    group: "tropical",
    bloomName: "Gold",
    flower: rgb(232, 184, 48),
    foliage: rgb(38, 84, 44),
    leafDensity: 0.6,
    flowerSize: 1.4,
    description: "Huge night-scented cups; needs a strong arbor",
  },
  {
    id: "shower_of_gold",
    name: "Shower of gold vine",
    botanical: "Tristellateia australasiae",
    group: "tropical",
    bloomName: "Yellow",
    flower: rgb(236, 196, 40),
    foliage: rgb(40, 94, 48),
    leafDensity: 0.7,
    flowerSize: 0.75,
  },
  {
    id: "cape_honeysuckle",
    name: "Cape honeysuckle",
    botanical: "Tecoma capensis",
    group: "tropical",
    bloomName: "Orange",
    flower: rgb(220, 86, 32),
    foliage: rgb(48, 100, 50),
    leafDensity: 0.72,
    flowerSize: 0.8,
    description: "Train as a vine; hummingbird magnet",
  },
  {
    id: "potato_vine",
    name: "Potato vine",
    botanical: "Solanum laxum",
    group: "tropical",
    bloomName: "White",
    flower: rgb(240, 240, 236),
    foliage: rgb(52, 108, 54),
    leafDensity: 0.76,
    flowerSize: 0.65,
  },
  {
    id: "creeping_fig",
    name: "Creeping fig",
    botanical: "Ficus pumila",
    group: "foliage",
    bloomName: "Foliage",
    flower: rgb(72, 112, 64),
    foliage: rgb(36, 86, 42),
    leafDensity: 0.96,
    flowerSize: 0.2,
    description: "Clings and carpets a trellis or wall; tiny fruit, not a showy bloom",
  },
];

export function isFloridaVineId(id: string | undefined | null): boolean {
  return typeof id === "string" && FLORIDA_VINES.some((v) => v.id === id);
}

export function resolveVineId(id?: string | null): string {
  return isFloridaVineId(id) ? id! : DEFAULT_VINE_ID;
}

export function getFloridaVine(id?: string | null): FloridaVine {
  const resolved = resolveVineId(id);
  return FLORIDA_VINES.find((v) => v.id === resolved)!;
}

export function vinesInGroup(group: VineGroup): FloridaVine[] {
  return FLORIDA_VINES.filter((v) => v.group === group);
}

export function vineCssColor(c: VineColor): string {
  return `rgb(${c.r}, ${c.g}, ${c.b})`;
}

export function vineDisplayName(vine: FloridaVine): string {
  if (vine.group === "bougainvillea" || vine.group === "passionflower" || vine.id.startsWith("mandevilla") || vine.id.startsWith("allamanda")) {
    return `${vine.name} · ${vine.bloomName}`;
  }
  if (vine.bloomName === "Foliage") return vine.name;
  return vine.name;
}

export const TRELLIS_CATALOG_IDS = ["trellis", "trellis_arbor"] as const;

export function isTrellisId(id: string | undefined | null): boolean {
  return id === "trellis" || id === "trellis_arbor";
}

export function defaultVineId(catalogItemId: string): string | undefined {
  return isTrellisId(catalogItemId) ? DEFAULT_VINE_ID : undefined;
}
