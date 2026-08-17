export type AddressParts = {
  street?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
};

export const DEFAULT_ADDRESS_COUNTRY = "US";

export const US_STATES: readonly { value: string; label: string }[] = [
  { value: "AL", label: "Alabama" },
  { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" },
  { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" },
  { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" },
  { value: "DE", label: "Delaware" },
  { value: "DC", label: "District of Columbia" },
  { value: "FL", label: "Florida" },
  { value: "GA", label: "Georgia" },
  { value: "HI", label: "Hawaii" },
  { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" },
  { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" },
  { value: "KS", label: "Kansas" },
  { value: "KY", label: "Kentucky" },
  { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" },
  { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" },
  { value: "MI", label: "Michigan" },
  { value: "MN", label: "Minnesota" },
  { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" },
  { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" },
  { value: "NV", label: "Nevada" },
  { value: "NH", label: "New Hampshire" },
  { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" },
  { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" },
  { value: "ND", label: "North Dakota" },
  { value: "OH", label: "Ohio" },
  { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" },
  { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" },
  { value: "SC", label: "South Carolina" },
  { value: "SD", label: "South Dakota" },
  { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" },
  { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" },
  { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" },
  { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" },
  { value: "WY", label: "Wyoming" },
];

export const ADDRESS_COUNTRIES: readonly { value: string; label: string }[] = [
  { value: "US", label: "United States" },
  { value: "CA", label: "Canada" },
  { value: "MX", label: "Mexico" },
];

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

export function normalizeAddress(parts: AddressParts): {
  street: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
} {
  const country = clean(parts.country) ?? DEFAULT_ADDRESS_COUNTRY;
  const stateRaw = clean(parts.state);
  const known = US_STATES.find(
    (row) =>
      row.value === stateRaw?.toUpperCase() ||
      row.label.toLowerCase() === stateRaw?.toLowerCase(),
  );
  return {
    street: clean(parts.street),
    city: clean(parts.city),
    state: known?.value ?? stateRaw,
    postalCode: clean(parts.postalCode),
    country,
  };
}

/** Single-line site address for lists, quotes, and permits. */
export function formatAddressLine(parts: AddressParts): string | null {
  const n = normalizeAddress(parts);
  const cityState = [n.city, n.state].filter(Boolean).join(", ");
  const locality = [cityState, n.postalCode].filter(Boolean).join(" ");
  const country =
    n.country && n.country !== DEFAULT_ADDRESS_COUNTRY ? n.country : null;
  const line = [n.street, locality, country].filter(Boolean).join(", ");
  return line || null;
}

export function formatProjectMetaLine(parts: {
  clientName?: string | null;
  phone?: string | null;
  address?: string | null;
}): string | null {
  const line = [clean(parts.clientName), clean(parts.phone), clean(parts.address)]
    .filter(Boolean)
    .join(" · ");
  return line || null;
}

export function locationLabel(parts: {
  city?: string | null;
  state?: string | null;
}): string {
  const city = clean(parts.city);
  const state = clean(parts.state);
  if (city && state) return `${city}, ${state}`;
  return city || state || "Unspecified";
}

export type MarketStateRow = {
  state: string;
  count: number;
  cities: { city: string; count: number }[];
};

export function rollupJobMarkets(
  jobs: readonly { city?: string | null; state?: string | null }[],
): {
  total: number;
  unlabeled: number;
  byState: MarketStateRow[];
} {
  const byState = new Map<string, Map<string, number>>();
  let unlabeled = 0;
  for (const job of jobs) {
    const state = clean(job.state);
    const city = clean(job.city);
    if (!state && !city) {
      unlabeled += 1;
      continue;
    }
    const stateKey = state ?? "Unspecified";
    const cityKey = city ?? "Unspecified";
    const cities = byState.get(stateKey) ?? new Map<string, number>();
    cities.set(cityKey, (cities.get(cityKey) ?? 0) + 1);
    byState.set(stateKey, cities);
  }
  const rows: MarketStateRow[] = [...byState.entries()]
    .map(([state, cities]) => {
      const cityRows = [...cities.entries()]
        .map(([city, count]) => ({ city, count }))
        .sort((a, b) => b.count - a.count || a.city.localeCompare(b.city));
      return {
        state,
        count: cityRows.reduce((sum, row) => sum + row.count, 0),
        cities: cityRows,
      };
    })
    .sort((a, b) => b.count - a.count || a.state.localeCompare(b.state));
  return { total: jobs.length, unlabeled, byState: rows };
}
