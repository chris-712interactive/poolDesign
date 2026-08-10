import { NextResponse } from "next/server";
import { prisma } from "@pool-design/db";
import { getSessionUser } from "@/lib/auth";
import { appBaseUrl, getStripe, stripeConfigured } from "@/lib/stripe";

/** Open Stripe Customer Portal for the current company. */
export async function POST() {
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

  const company = await prisma.company.findUnique({
    where: { id: user.companyId },
  });
  if (!company?.stripeCustomerId) {
    return NextResponse.json(
      { error: "No Stripe customer yet — start a subscription first" },
      { status: 400 },
    );
  }

  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: company.stripeCustomerId,
    return_url: `${appBaseUrl()}/app/admin`,
  });

  return NextResponse.json({ url: session.url });
}
