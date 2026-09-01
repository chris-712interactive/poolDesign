import { createHash } from "crypto";
import type { IncomingHttpHeaders } from "http";

export function ipFromHeaders(
  h: Headers | IncomingHttpHeaders | { get(name: string): string | null },
): string {
  const read = (name: string): string => {
    if (typeof (h as Headers).get === "function") {
      return ((h as Headers).get(name) ?? "").trim();
    }
    const raw = (h as IncomingHttpHeaders)[name];
    if (Array.isArray(raw)) return (raw[0] ?? "").trim();
    return (raw ?? "").trim();
  };

  const forwarded = read("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  const real = read("x-real-ip") || read("cf-connecting-ip");
  return (real || "unknown").slice(0, 64);
}

export function throttleEmailKey(prefix: string, email: string): string {
  const hash = createHash("sha256")
    .update(email.toLowerCase().trim())
    .digest("hex")
    .slice(0, 32);
  return `${prefix}:${hash}`;
}
