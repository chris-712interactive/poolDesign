import type Stripe from "stripe";
import { prisma } from "@pool-design/db";
import { designerSeatPriceId, getStripe } from "@/lib/stripe";

export function designerSeatQuantity(subscription: Stripe.Subscription): number {
  const priceId = designerSeatPriceId();
  if (!priceId) return 0;
  return subscription.items.data.reduce((sum, item) => {
    const id = typeof item.price === "string" ? item.price : item.price.id;
    if (id !== priceId) return sum;
    return sum + (item.quantity ?? 0);
  }, 0);
}

export function designerSeatItem(
  subscription: Stripe.Subscription,
): Stripe.SubscriptionItem | undefined {
  const priceId = designerSeatPriceId();
  if (!priceId) return undefined;
  return subscription.items.data.find((item) => {
    const id = typeof item.price === "string" ? item.price : item.price.id;
    return id === priceId;
  });
}

export async function syncDesignerSeatsFromSubscription(
  companyId: string,
  subscription: Stripe.Subscription,
): Promise<number> {
  const item = designerSeatItem(subscription);
  const quantity = designerSeatQuantity(subscription);
  await prisma.company.update({
    where: { id: companyId },
    data: {
      designerSeatsPaid: quantity,
      stripeDesignerItemId: item?.id ?? null,
      stripeCustomerId:
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer.id,
      stripeSubscriptionId: subscription.id,
    },
  });
  return quantity;
}

export async function retrieveSubscription(
  subscriptionId: string,
): Promise<Stripe.Subscription> {
  return getStripe().subscriptions.retrieve(subscriptionId, {
    expand: ["items.data.price"],
  });
}

/** Raise extra-seat quantity to match the team; never lower a prepaid quantity. */
export async function ensurePaidDesignerSeatQuantity(
  companyId: string,
  subscription: Stripe.Subscription,
  extrasNeeded: number,
): Promise<Stripe.Subscription> {
  const priceId = designerSeatPriceId();
  if (!priceId || extrasNeeded <= 0) {
    await syncDesignerSeatsFromSubscription(companyId, subscription);
    return subscription;
  }
  const stripe = getStripe();
  const existing = designerSeatItem(subscription);
  const currentQty = existing?.quantity ?? 0;
  if (existing && extrasNeeded > currentQty) {
    await stripe.subscriptionItems.update(existing.id, {
      quantity: extrasNeeded,
      proration_behavior: "create_prorations",
    });
  } else if (!existing) {
    await stripe.subscriptionItems.create({
      subscription: subscription.id,
      price: priceId,
      quantity: extrasNeeded,
      proration_behavior: "create_prorations",
    });
  } else {
    await syncDesignerSeatsFromSubscription(companyId, subscription);
    return subscription;
  }
  const updated = await retrieveSubscription(subscription.id);
  await syncDesignerSeatsFromSubscription(companyId, updated);
  return updated;
}
