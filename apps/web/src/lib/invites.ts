import bcrypt from "bcryptjs";
import { prisma } from "@pool-design/db";
import { appBaseUrl } from "@/lib/app-url";
import { completeMilestone, newInviteToken } from "@/lib/shares";

function tempPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 10; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
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
      temporaryPassword: string;
      inviteUrl: string;
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

  return {
    ok: true,
    email: invite.email,
    name: invite.name,
    role: invite.role,
    temporaryPassword: password,
    inviteUrl: `${appBaseUrl()}/invite/${invite.token}`,
  };
}
