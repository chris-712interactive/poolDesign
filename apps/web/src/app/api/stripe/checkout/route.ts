import { NextResponse } from "next/server";
import { prisma } from "@pool-design/db";
import { getSessionUser } from "@/lib/auth";
import {
  appBaseUrl,
  designerSeatPriceId,
  getStripe,
  priceIdForPlan,
  stripeConfigured,
} from "@/lib/stripe";
import { retrieveSubscription } from "@/lib/designerSeats";

/** Start Stripe Checkout for the current company. */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user?.companyId || user.role !== "company_admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!stripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe is not configured on this deployment" },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    planKey?: string;
  };
  const planKey = body.planKey === "pro" ? "pro" : "starter";
  const priceId = priceIdForPlan(planKey);
  if (!priceId) {
    return NextResponse.json(
      { error: `Missing Stripe price env for plan ${planKey}` },
      { status: 503 },
    );
  }

  const company = await prisma.company.findUnique({
    where: { id: user.companyId },
  });
  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  const stripe = getStripe();
  let customerId = company.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      name: company.name,
      email: user.email,
      metadata: { companyId: company.id, slug: company.slug },
    });
    customerId = customer.id;
    await prisma.company.update({
      where: { id: company.id },
      data: { stripeCustomerId: customerId },
    });
  }

  if (company.stripeSubscriptionId) {
    const subscription = await retrieveSubscription(
      company.stripeSubscriptionId,
    );
    const hasPlan = subscription.items.data.some((item) => {
      const id = typeof item.price === "string" ? item.price : item.price.id;
      return id === priceId;
    });
    if (!hasPlan) {
      await stripe.subscriptionItems.create({
        subscription: subscription.id,
        price: priceId,
        proration_behavior: "create_prorations",
      });
    }
    await stripe.subscriptions.update(subscription.id, {
      metadata: { companyId: company.id, planKey },
    });
    return NextResponse.json({
      url: `${appBaseUrl()}/app/admin?section=billing`,
    });
  }

  const lineItems: { price: string; quantity: number }[] = [
    { price: priceId, quantity: 1 },
  ];
  const designerPrice = designerSeatPriceId();
  if (designerPrice && company.designerSeatsPaid > 0) {
    lineItems.push({
      price: designerPrice,
      quantity: company.designerSeatsPaid,
    });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: lineItems,
    success_url: `${appBaseUrl()}/app/admin?billing=success`,
    cancel_url: `${appBaseUrl()}/app/admin?billing=canceled`,
    metadata: { companyId: company.id, planKey },
    payment_method_collection: "always",
    allow_promotion_codes: true,
    subscription_data: {
      metadata: { companyId: company.id, planKey },
    },
  });

  return NextResponse.json({ url: session.url });
}
