function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrapHtml(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${esc(title)}</title>
</head>
<body style="margin:0;background:#f7f4ef;color:#1a2420;font-family:Georgia,'Source Serif 4',serif;">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px 40px;">
    <p style="margin:0 0 16px;font-size:13px;letter-spacing:0.04em;text-transform:uppercase;color:#5c6b64;">PoolShape</p>
    <div style="background:#fff;padding:28px 24px;border:1px solid #d9e0db;">
      ${body}
    </div>
  </div>
</body>
</html>`;
}

export type InviteEmailInput = {
  inviteeName: string;
  companyName: string;
  roleLabel: string;
  inviteUrl: string;
  temporaryPassword: string;
  expiresLabel: string;
};

export function inviteEmail(input: InviteEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Join ${input.companyName} on PoolShape`;
  const html = wrapHtml(
    subject,
    `<p style="margin:0 0 12px;">Hi ${esc(input.inviteeName)},</p>
<p style="margin:0 0 12px;">You were invited to <strong>${esc(input.companyName)}</strong> as a ${esc(input.roleLabel)}.</p>
<p style="margin:0 0 12px;">Open this link, then enter the temporary password and choose your own:</p>
<p style="margin:0 0 16px;"><a href="${esc(input.inviteUrl)}">${esc(input.inviteUrl)}</a></p>
<p style="margin:0 0 12px;">Temporary password: <code style="font-size:15px;">${esc(input.temporaryPassword)}</code></p>
<p style="margin:0;color:#5c6b64;font-size:14px;">This invite expires ${esc(input.expiresLabel)}.</p>`,
  );
  const text = [
    `Hi ${input.inviteeName},`,
    "",
    `You were invited to ${input.companyName} as a ${input.roleLabel}.`,
    "",
    `Open this link, then enter the temporary password and choose your own:`,
    input.inviteUrl,
    "",
    `Temporary password: ${input.temporaryPassword}`,
    "",
    `This invite expires ${input.expiresLabel}.`,
  ].join("\n");
  return { subject, html, text };
}

export type WelcomeEmailInput = {
  name: string;
  companyName: string;
  loginUrl: string;
  trialDays: number;
};

export function welcomeEmail(input: WelcomeEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `${input.companyName} is on a ${input.trialDays}-day PoolShape trial`;
  const html = wrapHtml(
    subject,
    `<p style="margin:0 0 12px;">Hi ${esc(input.name)},</p>
<p style="margin:0 0 12px;"><strong>${esc(input.companyName)}</strong> has a ${input.trialDays}-day PoolShape trial. No credit card.</p>
<p style="margin:0 0 12px;">Sign in here:</p>
<p style="margin:0;"><a href="${esc(input.loginUrl)}">${esc(input.loginUrl)}</a></p>`,
  );
  const text = [
    `Hi ${input.name},`,
    "",
    `${input.companyName} has a ${input.trialDays}-day PoolShape trial. No credit card.`,
    "",
    `Sign in: ${input.loginUrl}`,
  ].join("\n");
  return { subject, html, text };
}

export type ResetPasswordEmailInput = {
  name: string;
  resetUrl: string;
};

export function resetPasswordEmail(input: ResetPasswordEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = "Reset your PoolShape password";
  const html = wrapHtml(
    subject,
    `<p style="margin:0 0 12px;">Hi ${esc(input.name)},</p>
<p style="margin:0 0 12px;">Use this link to choose a new password. It expires in one hour.</p>
<p style="margin:0 0 16px;"><a href="${esc(input.resetUrl)}">${esc(input.resetUrl)}</a></p>
<p style="margin:0;color:#5c6b64;font-size:14px;">If you did not ask for this, you can ignore the email.</p>`,
  );
  const text = [
    `Hi ${input.name},`,
    "",
    "Use this link to choose a new password. It expires in one hour.",
    input.resetUrl,
    "",
    "If you did not ask for this, you can ignore the email.",
  ].join("\n");
  return { subject, html, text };
}
