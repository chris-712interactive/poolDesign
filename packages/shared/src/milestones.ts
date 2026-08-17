export type MilestoneState =
  | "pending"
  | "in_progress"
  | "completed"
  | "dismissed";

export type MilestoneDefinition = {
  key: string;
  title: string;
  description: string;
  sortOrder: number;
};

/** Default company onboarding milestones for the platform owner console */
export const DEFAULT_ONBOARDING_MILESTONES: MilestoneDefinition[] = [
  {
    key: "account_created",
    title: "Account created",
    description: "Company account and trial started",
    sortOrder: 1,
  },
  {
    key: "subscription_active",
    title: "Subscription active",
    description: "Trial converted or paid plan active",
    sortOrder: 2,
  },
  {
    key: "company_profile",
    title: "Company profile completed",
    description: "Name, address, service area, and default units",
    sortOrder: 3,
  },
  {
    key: "subdomain_live",
    title: "Subdomain live",
    description: "Tenant subdomain (and optional custom domain) ready",
    sortOrder: 4,
  },
  {
    key: "admin_logged_in",
    title: "Admin logged in",
    description: "First company admin invited and signed in",
    sortOrder: 5,
  },
  {
    key: "team_invited",
    title: "Team invited",
    description: "Designers or estimators invited",
    sortOrder: 6,
  },
  {
    key: "price_book",
    title: "Price book configured",
    description: "Material catalog customized or defaults accepted",
    sortOrder: 7,
  },
  {
    key: "first_project",
    title: "First project created",
    description: "First pool project opened",
    sortOrder: 8,
  },
  {
    key: "first_design_saved",
    title: "First design with surrounds",
    description: "Pool and patio/surrounds saved",
    sortOrder: 9,
  },
  {
    key: "first_estimate",
    title: "First estimate generated",
    description: "Material list or cost estimate produced",
    sortOrder: 10,
  },
  {
    key: "first_client_share",
    title: "First client portal share",
    description: "Design shared with a client",
    sortOrder: 11,
  },
  {
    key: "first_contract_signed",
    title: "First contract signed",
    description: "Homeowner or operator signed a contract",
    sortOrder: 12,
  },
  {
    key: "first_payment_recorded",
    title: "First payment recorded",
    description: "Cash, check, card, or loan disbursement recorded",
    sortOrder: 13,
  },
  {
    key: "offline_sync",
    title: "Offline client sync",
    description: "Desktop/offline client installed and first sync",
    sortOrder: 14,
  },
];

export const STUCK_THRESHOLD_DAYS = 7;
