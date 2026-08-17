export const ACCOUNT_SECTIONS = ["profile", "units", "password"] as const;

export type AccountSection = (typeof ACCOUNT_SECTIONS)[number];

export function parseAccountSection(
  value: string | undefined,
  allowed: readonly AccountSection[] = ACCOUNT_SECTIONS,
): AccountSection {
  if (value && allowed.includes(value as AccountSection)) {
    return value as AccountSection;
  }
  return allowed[0] ?? "profile";
}
