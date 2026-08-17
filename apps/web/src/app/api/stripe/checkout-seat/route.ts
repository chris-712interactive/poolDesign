import { NextResponse } from "next/server";
import { prisma } from "@pool-design/db";
import {
  extraDesignerSeatsNeeded,
  isCompanyStaffRole,
  isLocalTrialActive,
} from "@pool-design/shared";
import { getSessionUser } from "@/lib/auth";
import { designerSeatPriceId, stripeConfigured } from "@/lib/stripe";
import { companyHasAppAccess } from "@/lib/subscription";
import { designerUserIdsOldestFirst, grantRoles } from "@/lib/roleGrants";
import {
  ensurePaidDesignerSeatQuantity,
  retrieveSubscription,
} from "@/lib/designerSeats";

/** Add an extra designer seat on a paid Sales/Builder subscription. */
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
  const trialActive = isLocalTrialActive(user.company);

  if (extrasNeeded <= paid || trialActive) {
    await grantRoles({
      userId: member.id,
      companyId: user.companyId,
      roles,
    });
    return NextResponse.json({
      ok: true,
      roles,
      ...(trialActive ? { trial: true } : {}),
    });
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

  if (!company.stripeSubscriptionId) {
    return NextResponse.json(
      {
        error:
          "Subscribe to Sales or Builder before adding extra designer licenses.",
        requiresPlanCheckout: true,
      },
      { status: 409 },
    );
  }

  const subscription = await retrieveSubscription(company.stripeSubscriptionId);
  await ensurePaidDesignerSeatQuantity(company.id, subscription, extrasNeeded);
  await grantRoles({
    userId: member.id,
    companyId: company.id,
    roles,
  });
  return NextResponse.json({ ok: true, roles });
}
