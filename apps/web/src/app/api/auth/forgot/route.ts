import { NextResponse } from "next/server";
import { startPasswordReset } from "@/lib/password-reset";
import { forgotAcknowledged } from "@/lib/password-reset-token";
import { ipFromHeaders, throttleEmailKey } from "@/lib/request-ip";
import {
  AUTH_LIMITS,
  assertNotThrottled,
  ThrottleError,
  throttleJson,
} from "@/lib/throttle";

/** Always 200 when the request is well-formed. Do not reveal whether the email exists. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { email?: string };
  const email = String(body.email || "").toLowerCase().trim();
  if (!email.includes("@")) {
    return NextResponse.json(forgotAcknowledged());
  }

  const ip = ipFromHeaders(request.headers);
  try {
    await assertNotThrottled({
      key: `forgot:ip:${ip}`,
      ...AUTH_LIMITS.forgotIp,
    });
    await assertNotThrottled({
      key: throttleEmailKey("forgot:email", email),
      ...AUTH_LIMITS.forgotEmail,
    });
  } catch (err) {
    if (err instanceof ThrottleError) return throttleJson();
    throw err;
  }

  await startPasswordReset(email);
  return NextResponse.json(forgotAcknowledged());
}
