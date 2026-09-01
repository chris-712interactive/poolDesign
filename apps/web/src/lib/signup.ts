import { ensureOnboardingMilestoneCatalog, prisma } from "@pool-design/db";
import bcrypt from "bcryptjs";
import {
  slugifyCompanyName,
  TRIAL_DURATION_DAYS,
  trialEndsAtFrom,
} from "@pool-design/shared";
import { appBaseUrl } from "@/lib/app-url";
import { sendMail } from "@/lib/mail";
import { welcomeEmail } from "@/lib/mail-templates";
import { MIN_PASSWORD } from "@/lib/password";

export type SignupInput = {
  companyName: string;
  name: string;
  email: string;
  password: string;
  /** Honeypot — must be empty. */
  website?: string;
};

export type SignupResult =
  | { ok: true; userId: string; companyId: string }
  | { ok: false; error: string };

async function uniqueSlug(base: string): Promise<string> {
  const root = slugifyCompanyName(base);
  for (let i = 0; i < 50; i++) {
    const slug = i === 0 ? root : `${root.slice(0, 40)}-${i + 1}`;
    const existing = await prisma.company.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!existing) return slug;
  }
  return `${root}-${Date.now().toString(36)}`;
}

/**
 * Create a company + admin on a 14-day local trial. No Stripe customer yet.
 */
export async function createTrialCompany(
  input: SignupInput,
): Promise<SignupResult> {
  if (input.website?.trim()) {
    return { ok: false, error: "Could not create account." };
  }
  const companyName = input.companyName.trim();
  const name = input.name.trim();
  const email = input.email.toLowerCase().trim();
  const password = input.password;
  if (!companyName || companyName.length < 2) {
    return { ok: false, error: "Enter your company name." };
  }
  if (!name) {
    return { ok: false, error: "Enter your name." };
  }
  if (!email || !email.includes("@")) {
    return { ok: false, error: "Enter a valid email." };
  }
  if (password.length < MIN_PASSWORD) {
    return { ok: false, error: `Password must be at least ${MIN_PASSWORD} characters.` };
  }

  const taken = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (taken) {
    return { ok: false, error: "An account with that email already exists. Sign in instead." };
  }

  const slug = await uniqueSlug(companyName);
  const passwordHash = await bcrypt.hash(password, 10);
  const trialEndsAt = trialEndsAtFrom();

  const result = await prisma.$transaction(async (tx) => {
    await ensureOnboardingMilestoneCatalog(tx);
    const company = await tx.company.create({
      data: {
        name: companyName,
        slug,
        subscriptionStatus: "trialing",
        planKey: "starter",
        trialEndsAt,
      },
    });

    const user = await tx.user.create({
      data: {
        email,
        name,
        passwordHash,
        role: "company_admin",
        companyId: company.id,
      },
    });

    const milestones = await tx.onboardingMilestone.findMany();
    if (milestones.length > 0) {
      const early = new Set(["account_created", "admin_logged_in"]);
      await tx.companyMilestoneStatus.createMany({
        data: milestones.map((m) => ({
          companyId: company.id,
          milestoneId: m.id,
          state: early.has(m.key) ? "completed" : "pending",
          source: early.has(m.key) ? "system" : null,
          completedAt: early.has(m.key) ? new Date() : null,
        })),
      });
    }

    return { userId: user.id, companyId: company.id };
  });

  const welcome = welcomeEmail({
    name,
    companyName,
    loginUrl: `${appBaseUrl()}/login`,
    trialDays: TRIAL_DURATION_DAYS,
  });
  await sendMail({
    to: email,
    subject: welcome.subject,
    html: welcome.html,
    text: welcome.text,
  });

  return { ok: true, ...result };
}
