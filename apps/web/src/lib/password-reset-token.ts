import { createHash, randomBytes } from "crypto";

export const RESET_TTL_MS = 60 * 60 * 1000;

export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newResetToken(): string {
  return randomBytes(32).toString("base64url");
}

export function inspectResetToken(
  row: { usedAt: Date | null; expiresAt: Date } | null,
  now: Date = new Date(),
): "missing" | "used" | "expired" | "ok" {
  if (!row) return "missing";
  if (row.usedAt) return "used";
  if (row.expiresAt.getTime() <= now.getTime()) return "expired";
  return "ok";
}

/** Public body for POST /api/auth/forgot — same for known and unknown emails. */
export function forgotAcknowledged(): { ok: true } {
  return { ok: true };
}
