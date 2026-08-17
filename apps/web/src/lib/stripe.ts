import Stripe from "stripe";
import { appBaseUrl } from "@/lib/app-url";

export { appBaseUrl };

let stripeSingleton: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  if (!stripeSingleton) {
    stripeSingleton = new Stripe(key, {
      apiVersion: "2026-07-29.dahlia",
    });
  }
  return stripeSingleton;
}

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function priceIdForPlan(planKey: string): string | null {
  if (planKey === "pro") {
    return process.env.STRIPE_PRICE_PRO_MONTHLY || null;
  }
  return process.env.STRIPE_PRICE_STARTER_MONTHLY || null;
}

export function designerSeatPriceId(): string | null {
  return process.env.STRIPE_PRICE_DESIGNER_SEAT_MONTHLY || null;
}
