/** Public support address. Unset until production config provides one. */
export function supportEmail(): string | null {
  const value = (
    process.env.SUPPORT_EMAIL ||
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL ||
    ""
  ).trim();
  return value || null;
}

export function supportMailto(): string | null {
  const email = supportEmail();
  return email ? `mailto:${email}` : null;
}
