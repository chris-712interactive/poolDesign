/** Scale-figure appearance options (sex, height, clothing). */

export type PersonSex = "female" | "male";

export type PersonOutfitId =
  | "swimsuit"
  | "casual"
  | "athletic"
  | "coverup";

export const PERSON_SEXES: { id: PersonSex; label: string }[] = [
  { id: "female", label: "Female" },
  { id: "male", label: "Male" },
];

export const PERSON_OUTFITS: {
  id: PersonOutfitId;
  label: string;
  hint: string;
}[] = [
  {
    id: "swimsuit",
    label: "Swimwear",
    hint: "Bikini / one-piece or swim trunks",
  },
  {
    id: "casual",
    label: "Casual",
    hint: "Tee and shorts — typical backyard look",
  },
  {
    id: "athletic",
    label: "Athletic",
    hint: "Tank and shorts",
  },
  {
    id: "coverup",
    label: "Cover-up",
    hint: "Sundress or light linen shirt",
  },
];

export const DEFAULT_PERSON_SEX: PersonSex = "female";
export const DEFAULT_PERSON_OUTFIT_ID: PersonOutfitId = "swimsuit";

/** Typical adult heights used as sex defaults. */
export const DEFAULT_PERSON_HEIGHT_FEMALE_MM = 1625.6; // 5′4″
export const DEFAULT_PERSON_HEIGHT_MALE_MM = 1778; // 5′10″

const FT = 304.8;
const IN = 25.4;

/** Clamp standing height (~4′10″–6′8″). */
export function resolvePersonHeightMm(heightMm?: number): number {
  if (heightMm != null && Number.isFinite(heightMm)) {
    return Math.min(2032, Math.max(1473.2, heightMm));
  }
  return DEFAULT_PERSON_HEIGHT_FEMALE_MM;
}

export function isPersonSex(value: unknown): value is PersonSex {
  return value === "female" || value === "male";
}

export function isPersonOutfitId(value: unknown): value is PersonOutfitId {
  return (
    value === "swimsuit" ||
    value === "casual" ||
    value === "athletic" ||
    value === "coverup"
  );
}

export function resolvePersonSex(sex?: string): PersonSex {
  return isPersonSex(sex) ? sex : DEFAULT_PERSON_SEX;
}

export function resolvePersonOutfitId(id?: string): PersonOutfitId {
  return isPersonOutfitId(id) ? id : DEFAULT_PERSON_OUTFIT_ID;
}

export function defaultPersonHeightMm(sex: PersonSex): number {
  return sex === "male"
    ? DEFAULT_PERSON_HEIGHT_MALE_MM
    : DEFAULT_PERSON_HEIGHT_FEMALE_MM;
}

export function personOutfitLabel(id: PersonOutfitId): string {
  return PERSON_OUTFITS.find((o) => o.id === id)?.label ?? id;
}

/** Plan footprint scales with height and sex (shoulders / stance). */
export function personFootprintMm(
  heightMm: number,
  sex: PersonSex,
): { widthMm: number; depthMm: number } {
  const h = resolvePersonHeightMm(heightMm);
  const scale = h / (5 * FT + 8 * IN);
  if (sex === "female") {
    return {
      widthMm: 17.5 * IN * scale,
      depthMm: 12 * IN * scale,
    };
  }
  return {
    widthMm: 20.5 * IN * scale,
    depthMm: 13.5 * IN * scale,
  };
}

export type PersonPalette = {
  skin: string;
  hair: string;
  top: string;
  bottom: string;
  shoes: string;
  /** Optional mid-layer (dress, cover-up) painted over torso. */
  cover?: string;
};

/** Outfit + sex → simple material colors for the procedural figure. */
export function personPalette(
  sex: PersonSex,
  outfitId: PersonOutfitId,
): PersonPalette {
  const skin = sex === "female" ? "#d2a88a" : "#c4a484";
  const hair = sex === "female" ? "#3b2a1e" : "#2a221c";
  const shoes = "#2a3036";

  switch (outfitId) {
    case "swimsuit":
      return sex === "female"
        ? {
            skin,
            hair,
            top: "#c45b6a",
            bottom: "#c45b6a",
            shoes: "#e8d5c4",
          }
        : {
            skin,
            hair,
            top: skin,
            bottom: "#1f4f6d",
            shoes: "#e8d5c4",
          };
    case "athletic":
      return sex === "female"
        ? {
            skin,
            hair,
            top: "#5a8f7b",
            bottom: "#2f3d45",
            shoes: "#f2f2f0",
          }
        : {
            skin,
            hair,
            top: "#3d6b8a",
            bottom: "#2a3038",
            shoes: "#f2f2f0",
          };
    case "coverup":
      return sex === "female"
        ? {
            skin,
            hair,
            top: "#e8d5b7",
            bottom: "#e8d5b7",
            shoes: "#c4a484",
            cover: "#e8d5b7",
          }
        : {
            skin,
            hair,
            top: "#f4efe6",
            bottom: "#5c6b7a",
            shoes,
            cover: "#f4efe6",
          };
    case "casual":
    default:
      return sex === "female"
        ? {
            skin,
            hair,
            top: "#7a9eb5",
            bottom: "#5a6a4a",
            shoes,
          }
        : {
            skin,
            hair,
            top: "#3d6b8a",
            bottom: "#3a4550",
            shoes,
          };
  }
}
