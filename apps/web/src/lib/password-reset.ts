import bcrypt from "bcryptjs";
import { prisma } from "@pool-design/db";
import { appBaseUrl } from "@/lib/app-url";
import { sendMail } from "@/lib/mail";
import { resetPasswordEmail } from "@/lib/mail-templates";
import { MIN_PASSWORD } from "@/lib/password";
import {
  hashResetToken,
  inspectResetToken,
  newResetToken,
  RESET_TTL_MS,
} from "@/lib/password-reset-token";

export { hashResetToken, inspectResetToken, newResetToken, RESET_TTL_MS };

/**
 * Always succeeds from the caller's point of view (no email oracle).
 * Sends mail only when the account exists.
 */
export async function startPasswordReset(email: string): Promise<{ ok: true }> {
  const normalized = email.toLowerCase().trim();
  if (!normalized.includes("@")) return { ok: true };

  try {
    const user = await prisma.user.findUnique({
      where: { email: normalized },
      select: { id: true, name: true, email: true },
    });
    if (!user) return { ok: true };

    const token = newResetToken();
    const tokenHash = hashResetToken(token);
    const expiresAt = new Date(Date.now() + RESET_TTL_MS);

    await prisma.$transaction([
      prisma.passwordResetToken.deleteMany({
        where: { userId: user.id, usedAt: null },
      }),
      prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash, expiresAt },
      }),
    ]);

    const resetUrl = `${appBaseUrl()}/reset/${token}`;
    const mail = resetPasswordEmail({
      name: user.name,
      resetUrl,
    });
    await sendMail({
      to: user.email,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    });
  } catch (err) {
    console.error("startPasswordReset failed", err);
  }

  return { ok: true };
}

export type CompleteResetResult =
  | { ok: true; userId: string; sessionEpoch: number }
  | { ok: false; status: number; error: string };

export async function completePasswordReset(
  rawToken: string,
  newPassword: string,
  now: Date = new Date(),
): Promise<CompleteResetResult> {
  const token = rawToken.trim();
  if (!token) {
    return { ok: false, status: 400, error: "This reset link is invalid or has expired." };
  }
  if (newPassword.length < MIN_PASSWORD) {
    return {
      ok: false,
      status: 400,
      error: `Password must be at least ${MIN_PASSWORD} characters.`,
    };
  }

  const tokenHash = hashResetToken(token);
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, usedAt: true, expiresAt: true },
  });
  const status = inspectResetToken(row, now);
  if (status !== "ok" || !row) {
    return {
      ok: false,
      status: 400,
      error: "This reset link is invalid or has expired.",
    };
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const consumed = await tx.passwordResetToken.updateMany({
        where: {
          id: row.id,
          usedAt: null,
          expiresAt: { gt: now },
        },
        data: { usedAt: now },
      });
      if (consumed.count !== 1) {
        throw new Error("RESET_CONSUME_FAILED");
      }
      return tx.user.update({
        where: { id: row.userId },
        data: {
          passwordHash,
          sessionEpoch: { increment: 1 },
        },
        select: { id: true, sessionEpoch: true },
      });
    });

    return {
      ok: true,
      userId: updated.id,
      sessionEpoch: updated.sessionEpoch,
    };
  } catch (err) {
    if (err instanceof Error && err.message === "RESET_CONSUME_FAILED") {
      return {
        ok: false,
        status: 400,
        error: "This reset link is invalid or has expired.",
      };
    }
    console.error("completePasswordReset failed", err);
    return { ok: false, status: 500, error: "Could not reset password." };
  }
}
