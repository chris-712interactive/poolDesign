import { createHmac, timingSafeEqual } from "crypto";

const DEV_SESSION_SECRET = "dev-session-secret-change-me";
const PLACEHOLDER_SECRETS = new Set([
  "",
  DEV_SESSION_SECRET,
  "change-me-in-production-use-a-long-random-string",
]);

export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

function secret() {
  const value = process.env.SESSION_SECRET?.trim() ?? "";
  if (process.env.NODE_ENV === "production" && PLACEHOLDER_SECRETS.has(value)) {
    throw new Error(
      "SESSION_SECRET must be a long random string in production (see .env.example).",
    );
  }
  return value || DEV_SESSION_SECRET;
}

function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export type SessionClaims = {
  userId: string;
  sessionEpoch: number;
};

/** Cookie value: userId.issuedAtMs.sessionEpoch.hmac */
export function createSessionToken(
  userId: string,
  sessionEpoch: number,
): string {
  const payload = `${userId}.${Date.now()}.${sessionEpoch}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string): SessionClaims | null {
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [userId, ts, epochStr, sig] = parts;
  if (!userId || !ts || !epochStr || !sig) return null;
  const payload = `${userId}.${ts}.${epochStr}`;
  const expected = sign(payload);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  const age = Date.now() - Number(ts);
  if (!Number.isFinite(age) || age > SESSION_MAX_AGE_SECONDS * 1000) return null;
  const sessionEpoch = Number(epochStr);
  if (!Number.isInteger(sessionEpoch) || sessionEpoch < 0) return null;
  return { userId, sessionEpoch };
}
