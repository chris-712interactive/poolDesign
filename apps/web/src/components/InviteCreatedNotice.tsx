"use client";

type Props = {
  email: string;
  inviteUrl: string;
  emailSent: boolean;
  emailError?: string | null;
  temporaryPassword: string | null;
};

export function InviteCreatedNotice({
  email,
  inviteUrl,
  emailSent,
  emailError,
  temporaryPassword,
}: Props) {
  return (
    <div className="panel" style={{ background: "var(--accent-soft)" }}>
      {emailSent ? (
        <p>
          Email sent to <strong>{email}</strong> with the invite link and
          one-time password.
        </p>
      ) : (
        <>
          <p>
            Invite for <strong>{email}</strong>. Email was not sent — copy the
            link and password now.
          </p>
          {emailError ? <p className="muted">{emailError}</p> : null}
        </>
      )}
      <p>
        Link:{" "}
        <a href={inviteUrl} target="_blank" rel="noreferrer">
          {inviteUrl}
        </a>
      </p>
      {emailSent || !temporaryPassword ? null : (
        <>
          <p>
            Temporary password: <code>{temporaryPassword}</code>
          </p>
          <p className="muted">The password is only shown once.</p>
        </>
      )}
    </div>
  );
}
