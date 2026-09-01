import bcrypt from "bcryptjs";
import { USER_ROLE_LABELS } from "@pool-design/shared";
import { prisma } from "@pool-design/db";
import { appBaseUrl } from "@/lib/app-url";
import { sendMail } from "@/lib/mail";
import { inviteEmail } from "@/lib/mail-templates";
import { completeMilestone, newInviteToken } from "@/lib/shares";

function tempPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 10; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

function expiresLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export type InviteCreateInput = {
  companyId: string;
  invitedByUserId: string;
  email: string;
  name: string;
  role: "designer" | "estimator" | "company_admin";
};

export type InviteCreateResult =
  | {
      ok: true;
      email: string;
      name: string;
      role: string;
      inviteUrl: string;
      emailSent: boolean;
      /** Present only when mail was skipped or failed — copy from the admin UI. */
      temporaryPassword: string | null;
    }
  | { ok: false; status: number; error: string };

export async function createCompanyInvite(
  input: InviteCreateInput,
): Promise<InviteCreateResult> {
  const email = input.email.toLowerCase().trim();
  const name = input.name.trim();
  if (!email || !name) {
    return { ok: false, status: 400, error: "Name and email are required" };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return {
      ok: false,
      status: 409,
      error: "A user with that email already exists",
    };
  }

  const company = await prisma.company.findUnique({
    where: { id: input.companyId },
    select: { name: true },
  });
  if (!company) {
    return { ok: false, status: 404, error: "Company not found" };
  }

  const password = tempPassword();
  const temporaryPasswordHash = await bcrypt.hash(password, 10);
  const token = newInviteToken();
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  const invite = await prisma.companyInvite.create({
    data: {
      companyId: input.companyId,
      email,
      name,
      role: input.role,
      token,
      temporaryPasswordHash,
      invitedByUserId: input.invitedByUserId,
      expiresAt,
    },
  });

  await completeMilestone(input.companyId, "team_invited");

  const inviteUrl = `${appBaseUrl()}/invite/${invite.token}`;
  const mail = inviteEmail({
    inviteeName: invite.name,
    companyName: company.name,
    roleLabel: USER_ROLE_LABELS[input.role],
    inviteUrl,
    temporaryPassword: password,
    expiresLabel: expiresLabel(expiresAt),
  });
  const sent = await sendMail({
    to: invite.email,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
  });

  return {
    ok: true,
    email: invite.email,
    name: invite.name,
    role: invite.role,
    inviteUrl,
    emailSent: sent.sent,
    temporaryPassword: sent.sent ? null : password,
  };
}
