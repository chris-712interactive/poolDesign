import { NextResponse } from "next/server";

export class ThrottleError extends Error {
  readonly status = 429 as const;
  constructor(message = "Too many attempts. Try again later.") {
    super(message);
    this.name = "ThrottleError";
  }
}

export const AUTH_LIMITS = {
  loginIp: { limit: 10, windowSec: 15 * 60 },
  loginEmail: { limit: 8, windowSec: 15 * 60 },
  signupIp: { limit: 5, windowSec: 60 * 60 },
  forgotEmail: { limit: 5, windowSec: 60 * 60 },
  forgotIp: { limit: 10, windowSec: 60 * 60 },
  resetIp: { limit: 10, windowSec: 60 * 60 },
  inviteAcceptIp: { limit: 10, windowSec: 60 * 60 },
} as const;

export type ThrottleIncrement = (
  key: string,
  windowStart: Date,
) => Promise<number>;

export function throttleWindowStart(now: Date, windowSec: number): Date {
  const ms = windowSec * 1000;
  return new Date(Math.floor(now.getTime() / ms) * ms);
}

async function prismaIncrement(key: string, windowStart: Date): Promise<number> {
  const { prisma } = await import("@pool-design/db");
  const row = await prisma.authThrottle.upsert({
    where: { key_windowStart: { key, windowStart } },
    create: { key, windowStart, count: 1 },
    update: { count: { increment: 1 } },
    select: { count: true },
  });
  return row.count;
}

/**
 * Increment the bucket and throw ThrottleError when over limit.
 * Fail closed if the counter cannot be written.
 */
export async function assertNotThrottled(opts: {
  key: string;
  limit: number;
  windowSec: number;
  now?: Date;
  increment?: ThrottleIncrement;
}): Promise<void> {
  const now = opts.now ?? new Date();
  const windowStart = throttleWindowStart(now, opts.windowSec);
  const increment = opts.increment ?? prismaIncrement;
  let count: number;
  try {
    count = await increment(opts.key, windowStart);
  } catch (err) {
    console.error("assertNotThrottled failed", err);
    throw new ThrottleError();
  }
  if (count > opts.limit) throw new ThrottleError();
}

export function throttleJson() {
  return NextResponse.json(
    { error: "Too many attempts. Try again later." },
    { status: 429 },
  );
}
