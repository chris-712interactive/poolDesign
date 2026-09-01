import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth";
import { completePasswordReset } from "@/lib/password-reset";
import { ipFromHeaders } from "@/lib/request-ip";
import {
  AUTH_LIMITS,
  assertNotThrottled,
  ThrottleError,
  throttleJson,
} from "@/lib/throttle";

export async function POST(request: Request) {
  const ip = ipFromHeaders(request.headers);
  try {
    await assertNotThrottled({
      key: `reset:ip:${ip}`,
      ...AUTH_LIMITS.resetIp,
    });
  } catch (err) {
    if (err instanceof ThrottleError) return throttleJson();
    throw err;
  }

  const body = (await request.json().catch(() => ({}))) as {
    token?: string;
    password?: string;
    confirmPassword?: string;
  };
  const token = String(body.token || "");
  const password = String(body.password || "");
  const confirm = String(body.confirmPassword || "");
  if (password !== confirm) {
    return NextResponse.json(
      { error: "New password and confirmation do not match." },
      { status: 400 },
    );
  }

  const result = await completePasswordReset(token, password);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  await setSessionCookie(result.userId, result.sessionEpoch);
  return NextResponse.json({ ok: true });
}
