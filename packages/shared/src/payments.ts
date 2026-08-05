export type PaymentMethod = "cash" | "check" | "card" | "loan" | "other";

export type PaymentInstallmentStatus =
  | "due"
  | "processing"
  | "paid"
  | "failed"
  | "refunded"
  | "recorded";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  check: "Check",
  card: "Card (in-app)",
  loan: "Loan disbursement",
  other: "Other",
};
