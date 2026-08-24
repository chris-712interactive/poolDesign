export const TOUR_QUERY = "tour";
export const TOUR_STEP_QUERY = "step";

export type TourId = "admin" | "staff" | "cad";

export type TourStep = {
  id: string;
  title: string;
  body: string;
  target: string;
  /** Load this path before highlighting (same-origin). */
  href?: string;
  /** Click this control first (admin section tabs). */
  reveal?: string;
};

const STORAGE_KEY = "poolshape.tour.v1";

type Progress = Partial<Record<TourId, boolean>>;

function storageKey(userId: string): string {
  return `${STORAGE_KEY}:${userId}`;
}

export function readTourProgress(userId: string): Progress {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Progress;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function markTourDone(userId: string, tour: TourId) {
  if (typeof window === "undefined") return;
  const next = { ...readTourProgress(userId), [tour]: true };
  window.localStorage.setItem(storageKey(userId), JSON.stringify(next));
}

export function clearTourDone(userId: string, tour?: TourId) {
  if (typeof window === "undefined") return;
  if (!tour) {
    window.localStorage.removeItem(storageKey(userId));
    return;
  }
  const next = { ...readTourProgress(userId), [tour]: false };
  window.localStorage.setItem(storageKey(userId), JSON.stringify(next));
}

export const ADMIN_TOUR: TourStep[] = [
  {
    id: "job",
    title: "Start a job",
    body: "A job is one backyard. Name it and add the city so you can find it later.",
    target: '[data-tour="create-project"]',
    href: "/app?tour=admin&step=0",
  },
  {
    id: "admin-link",
    title: "Your shop",
    body: "Team, prices, and how quotes look all live here. Let’s set those next.",
    target: '[data-tour="nav-admin"]',
    href: "/app?tour=admin&step=1",
  },
  {
    id: "company",
    title: "Name and logo",
    body: "This is what shows on PDFs. Put the company name and logo here.",
    target: '[data-tour="admin-nav-company"]',
    href: "/app/admin?section=company&tour=admin&step=2",
    reveal: '[data-tour="admin-nav-company"]',
  },
  {
    id: "team",
    title: "Who draws",
    body: "Invite a designer if that isn’t you. You can stay on billing.",
    target: '[data-tour="admin-nav-team"]',
    href: "/app/admin?section=team&tour=admin&step=3",
    reveal: '[data-tour="admin-nav-team"]',
  },
  {
    id: "prices",
    title: "Your prices",
    body: "These are your dollar amounts. The drawing fills in how much of each thing.",
    target: '[data-tour="admin-nav-prices"]',
    href: "/app/admin?section=prices&tour=admin&step=4",
    reveal: '[data-tour="admin-nav-prices"]',
  },
  {
    id: "recipe",
    title: "What you bill for",
    body: "Like a cost form: you pick the lines, we fill the measurements from the plan.",
    target: '[data-tour="admin-nav-recipe"]',
    href: "/app/admin?section=recipe&tour=admin&step=5",
    reveal: '[data-tour="admin-nav-recipe"]',
  },
  {
    id: "billing",
    title: "Stay on after the trial",
    body: "Sales is for showing the design. Builder adds quotes and this cost form.",
    target: '[data-tour="admin-nav-billing"]',
    href: "/app/admin?section=billing&tour=admin&step=6",
    reveal: '[data-tour="admin-nav-billing"]',
  },
];

export const STAFF_TOUR: TourStep[] = [
  {
    id: "jobs",
    title: "Jobs live here",
    body: "Open a backyard to draw, or start a new one. Your shop’s prices are already set.",
    target: '[data-tour="create-project"]',
    href: "/app?tour=staff&step=0",
  },
  {
    id: "account",
    title: "Your account",
    body: "Feet or meters, and your password, are in Account.",
    target: '[data-tour="nav-account"]',
    href: "/app?tour=staff&step=1",
  },
];

export const CAD_TOUR: TourStep[] = [
  {
    id: "design",
    title: "Draw here",
    body: "Pool, patio, and plumbing go on this sheet. That’s the job.",
    target: '[data-tour="view-design"]',
  },
  {
    id: "layout",
    title: "The layout sheet",
    body: "A clean plan of the pool, spa, pavers, and distances from the house. Export it as PDF.",
    target: '[data-tour="view-layout"]',
  },
  {
    id: "measurements",
    title: "The tape measure",
    body: "Lengths and areas from what you drew. No prices yet — just quantities.",
    target: '[data-tour="view-measurements"]',
  },
  {
    id: "estimate",
    title: "The cost list",
    body: "Your shop’s prices times those quantities. This is the estimate.",
    target: '[data-tour="view-estimate"]',
  },
];

export const TOURS: Record<TourId, TourStep[]> = {
  admin: ADMIN_TOUR,
  staff: STAFF_TOUR,
  cad: CAD_TOUR,
};

export function isTourId(value: string | null): value is TourId {
  return value === "admin" || value === "staff" || value === "cad";
}

export function parseTourStep(raw: string | null, length: number): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) return 0;
  return Math.min(n, Math.max(0, length - 1));
}

export function tourHref(tour: TourId, step: number, fallbackPath: string): string {
  const def = TOURS[tour][step];
  if (def?.href) return def.href;
  return withTourParams(fallbackPath, tour, step);
}

export function withTourParams(
  pathWithSearch: string,
  tour: TourId,
  step: number,
): string {
  const url = new URL(pathWithSearch, "http://local.invalid");
  url.searchParams.set(TOUR_QUERY, tour);
  url.searchParams.set(TOUR_STEP_QUERY, String(step));
  return `${url.pathname}?${url.searchParams.toString()}`;
}

export function stripTourParams(pathWithSearch: string): string {
  const url = new URL(pathWithSearch, "http://local.invalid");
  url.searchParams.delete(TOUR_QUERY);
  url.searchParams.delete(TOUR_STEP_QUERY);
  const q = url.searchParams.toString();
  return q ? `${url.pathname}?${q}` : url.pathname;
}
