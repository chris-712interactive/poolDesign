export const ADMIN_SECTIONS = [
  "company",
  "team",
  "markets",
  "prices",
  "recipe",
  "billing",
] as const;

export type AdminSection = (typeof ADMIN_SECTIONS)[number];

export function parseAdminSection(value: string | undefined): AdminSection {
  return ADMIN_SECTIONS.includes(value as AdminSection)
    ? (value as AdminSection)
    : "company";
}
