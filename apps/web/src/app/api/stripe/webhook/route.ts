import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma, type SubscriptionStatus } from "@pool-design/db";
import { completeMilestone } from "@/lib/shares";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import {
  retrieveSubscription,
  syncDesignerSeatsFromSubscription,
} from "@/lib/designerSeats";
import { grantRoles } from "@/lib/roleGrants";
import { isCompanyStaffRole } from "@pool-design/shared";

export const runtime = "nodejs";

function mapStripeStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    case "paused":
      return "suspended";
    default:
      return "past_due";
  }
}

async function applySubscription(
  companyId: string,
  subscription: Stripe.Subscription,
  planKey?: string | null,
) {
  const status = mapStripeStatus(subscription.status);
  await prisma.company.update({
    where: { id: companyId },
    data: {
      stripeSubscriptionId: subscription.id,
      stripeCustomerId:
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer.id,
      // Paid Checkout is never a Stripe trial. Keep our local "trialing"
      // status only until a real subscription exists.
      subscriptionStatus: status === "trialing" ? "active" : status,
      ...(planKey ? { planKey } : {}),
      trialEndsAt: null,
    },
  });

  await syncDesignerSeatsFromSubscription(companyId, subscription);

  if (status === "active" || status === "trialing") {
    await completeMilestone(companyId, "subscription_active");
  }
}

export async function POST(request: Request) {
  if (!stripeConfigured()) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const stripe = getStripe();
  const sig = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) {
    return NextResponse.json({ error: "Missing webhook secret" }, { status: 400 });
  }

  const rawBody = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (err) {
    console.error("stripe webhook verify failed", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const companyId = session.metadata?.companyId;
      const planKey = session.metadata?.planKey;
      const kind = session.metadata?.kind;
      if (companyId && session.subscription) {
        const subId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription.id;
        const subscription = await retrieveSubscription(subId);
        if (kind === "designer_seat") {
          // Legacy seat-only Checkout. New extra seats attach to Sales/Builder.
          await syncDesignerSeatsFromSubscription(companyId, subscription);
          const userId = session.metadata?.userId;
          const roles = (session.metadata?.roles || "designer")
            .split(",")
            .filter(isCompanyStaffRole);
          if (userId && roles.length > 0) {
            await grantRoles({ userId, companyId, roles });
          }
          if (session.id) {
            await prisma.seatCheckout.updateMany({
              where: { stripeSessionId: session.id },
              data: { status: "completed" },
            });
          }
        } else {
          await applySubscription(companyId, subscription, planKey);
        }
      }
    } else if (
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const subscription = event.data.object as Stripe.Subscription;
      const companyId =
        subscription.metadata?.companyId ||
        (
          await prisma.company.findFirst({
            where: {
              OR: [
                { stripeSubscriptionId: subscription.id },
                {
                  stripeCustomerId:
                    typeof subscription.customer === "string"
                      ? subscription.customer
                      : subscription.customer.id,
                },
              ],
            },
            select: { id: true },
          })
        )?.id;

      if (companyId) {
        if (event.type === "customer.subscription.deleted") {
          const company = await prisma.company.findUnique({
            where: { id: companyId },
            select: {
              subscriptionStatus: true,
              trialEndsAt: true,
            },
          });
          const stillOnLocalTrial =
            company?.subscriptionStatus === "trialing" &&
            subscription.metadata?.kind === "designer_seat";
          await prisma.company.update({
            where: { id: companyId },
            data: stillOnLocalTrial
              ? {
                  designerSeatsPaid: 0,
                  stripeDesignerItemId: null,
                  stripeSubscriptionId: null,
                }
              : {
                  subscriptionStatus: "canceled",
                  stripeSubscriptionId: subscription.id,
                  designerSeatsPaid: 0,
                },
          });
        } else if (
          subscription.metadata?.kind === "designer_seat" &&
          !subscription.metadata?.planKey
        ) {
          await syncDesignerSeatsFromSubscription(
            companyId,
            await retrieveSubscription(subscription.id),
          );
        } else {
          await applySubscription(
            companyId,
            subscription,
            subscription.metadata?.planKey,
          );
        }
      }
    }
  } catch (err) {
    console.error("stripe webhook handler error", err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
