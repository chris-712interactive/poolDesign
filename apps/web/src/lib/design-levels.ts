import {
  isDesignLevel,
  publicDesignLevels,
  type DesignLevel,
} from "@pool-design/shared";

export function companyPublicDesignLevels(raw: string | null | undefined): DesignLevel[] {
  const companyLevels = (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(isDesignLevel);
  return publicDesignLevels(companyLevels, {
    commercial: process.env.NEXT_PUBLIC_ENABLE_COMMERCIAL === "1",
    waterPark: process.env.NEXT_PUBLIC_ENABLE_WATER_PARK === "1",
  });
}
