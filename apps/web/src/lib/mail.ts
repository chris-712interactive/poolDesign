export type SendMailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type SendMailResult =
  | { sent: true; id: string }
  | { sent: false; reason: "unset" | "failed"; error?: string };

export type MailConfig = {
  apiKey?: string | null;
  from?: string | null;
};

export type MailSendFn = (
  message: SendMailInput & { from: string },
) => Promise<{ id: string }>;

type EnvLike = Record<string, string | undefined>;

export function readMailConfig(env: EnvLike = process.env): MailConfig {
  return {
    apiKey: env.RESEND_API_KEY?.trim() || null,
    from: env.MAIL_FROM?.trim() || null,
  };
}

export function isMailConfigured(
  config: MailConfig = readMailConfig(),
): boolean {
  return Boolean(config.apiKey && config.from);
}

async function resendSend(
  apiKey: string,
  message: SendMailInput & { from: string },
): Promise<{ id: string }> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: message.from,
      to: [message.to],
      subject: message.subject,
      html: message.html,
      text: message.text,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    id?: string;
    message?: string;
    error?: { message?: string };
  };
  if (!res.ok || !json.id) {
    throw new Error(
      json.error?.message || json.message || `Resend HTTP ${res.status}`,
    );
  }
  return { id: json.id };
}

/**
 * Send one transactional message via Resend.
 * When RESEND_API_KEY or MAIL_FROM is missing, no-ops so local Docker still works.
 */
export async function sendMail(
  input: SendMailInput,
  options?: { config?: MailConfig; send?: MailSendFn },
): Promise<SendMailResult> {
  const config = options?.config ?? readMailConfig();
  if (!config.apiKey || !config.from) {
    return { sent: false, reason: "unset" };
  }
  const send =
    options?.send ?? ((message) => resendSend(config.apiKey!, message));
  try {
    const { id } = await send({ ...input, from: config.from });
    return { sent: true, id };
  } catch (err) {
    console.error("sendMail failed", err);
    return {
      sent: false,
      reason: "failed",
      error: err instanceof Error ? err.message : "send failed",
    };
  }
}
