import { NextResponse } from "next/server";
import { prisma } from "@pool-design/db";
import {
  extraDesignerSeatsNeeded,
  isCompanyStaffRole,
} from "@pool-design/shared";
import { getSessionUser } from "@/lib/auth";
import {
  appBaseUrl,
  designerSeatPriceId,
  getStripe,
  stripeConfigured,
} from "@/lib/stripe";
import { companyHasAppAccess } from "@/lib/subscription";
import { designerUserIdsOldestFirst, grantRoles } from "@/lib/roleGrants";
import {
  designerSeatItem,
  retrieveSubscription,
  syncDesignerSeatsFromSubscription,
} from "@/lib/designerSeats";

/** Buy extra designer seat(s) and assign the designer role after payment. */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user?.companyId || user.role !== "company_admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!companyHasAppAccess(user.company)) {
    return NextResponse.json({ error: "Subscription inactive" }, { status: 402 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    userId?: string;
    roles?: string[];
  };
  const memberId = String(body.userId || "");
  const roles = (body.roles ?? []).filter(isCompanyStaffRole);
  if (!memberId || !roles.includes("designer")) {
    return NextResponse.json(
      { error: "A teammate and the designer role are required." },
      { status: 400 },
    );
  }

  const member = await prisma.user.findFirst({
    where: { id: memberId, companyId: user.companyId },
    select: { id: true },
  });
  if (!member) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const designerIds = await designerUserIdsOldestFirst(user.companyId);
  const alreadyDesigner = designerIds.includes(member.id);
  const nextCount = alreadyDesigner
    ? designerIds.length
    : designerIds.length + 1;
  const extrasNeeded = extraDesignerSeatsNeeded(nextCount);
  const paid = user.company?.designerSeatsPaid ?? 0;
  if (extrasNeeded <= paid) {
    await grantRoles({
      userId: member.id,
      companyId: user.companyId,
      roles,
    });
    return NextResponse.json({ ok: true, roles });
  }

  const priceId = designerSeatPriceId();
  if (!stripeConfigured() || !priceId) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        {
          error:
            "Designer licenses are not configured (STRIPE_PRICE_DESIGNER_SEAT_MONTHLY).",
        },
        { status: 503 },
      );
    }
    await grantRoles({
      userId: member.id,
      companyId: user.companyId,
      roles,
    });
    await prisma.company.update({
      where: { id: user.companyId },
      data: { designerSeatsPaid: extrasNeeded },
    });
    return NextResponse.json({ ok: true, roles, local: true });
  }

  const company = await prisma.company.findUnique({
    where: { id: user.companyId },
  });
  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  const stripe = getStripe();
  const nextPaid = extrasNeeded;

  if (company.stripeSubscriptionId) {
    const subscription = await retrieveSubscription(
      company.stripeSubscriptionId,
    );
    const existing = designerSeatItem(subscription);
    if (existing) {
      await stripe.subscriptionItems.update(existing.id, {
        quantity: nextPaid,
        proration_behavior: "create_prorations",
      });
    } else {
      await stripe.subscriptionItems.create({
        subscription: subscription.id,
        price: priceId,
        quantity: nextPaid,
        proration_behavior: "create_prorations",
      });
    }
    const updated = await retrieveSubscription(subscription.id);
    await syncDesignerSeatsFromSubscription(company.id, updated);
    await grantRoles({
      userId: member.id,
      companyId: company.id,
      roles,
    });
    return NextResponse.json({ ok: true, roles });
  }

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

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: nextPaid }],
    success_url: `${appBaseUrl()}/app/admin?section=team&seat=success`,
    cancel_url: `${appBaseUrl()}/app/admin?section=team&seat=canceled`,
    metadata: {
      companyId: company.id,
      kind: "designer_seat",
      userId: member.id,
      roles: roles.join(","),
    },
    payment_method_collection: "always",
    allow_promotion_codes: true,
    subscription_data: {
      metadata: { companyId: company.id, kind: "designer_seat" },
    },
  });
  if (!session.id || !session.url) {
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }

  await prisma.seatCheckout.create({
    data: {
      companyId: company.id,
      userId: member.id,
      role: "designer",
      stripeSessionId: session.id,
      status: "pending",
    },
  });

  return NextResponse.json({ url: session.url });
}
