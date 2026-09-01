import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isMailConfigured, sendMail, type MailSendFn } from "./mail";
import { inviteEmail, resetPasswordEmail, welcomeEmail } from "./mail-templates";

describe("sendMail", () => {
  it("no-ops with reason unset when API key and from are missing", async () => {
    let called = false;
    const send: MailSendFn = async () => {
      called = true;
      return { id: "should-not-run" };
    };
    const result = await sendMail(
      {
        to: "designer@example.com",
        subject: "Test",
        html: "<p>Hi</p>",
        text: "Hi",
      },
      { config: {}, send },
    );
    assert.equal(result.sent, false);
    if (result.sent) throw new Error("expected skip");
    assert.equal(result.reason, "unset");
    assert.equal(result.error, "RESEND_API_KEY is not set on this server");
    assert.equal(called, false);
  });

  it("no-ops when only the API key is set", async () => {
    const result = await sendMail(
      {
        to: "designer@example.com",
        subject: "Test",
        html: "<p>Hi</p>",
        text: "Hi",
      },
      { config: { apiKey: "re_test", from: null } },
    );
    assert.equal(result.sent, false);
    if (result.sent) throw new Error("expected skip");
    assert.equal(result.reason, "unset");
    assert.equal(result.error, "MAIL_FROM is not set on this server");
  });

  it("sends through the transport when configured", async () => {
    const result = await sendMail(
      {
        to: "designer@example.com",
        subject: "Join Acme on PoolShape",
        html: "<p>Hi</p>",
        text: "Hi",
      },
      {
        config: {
          apiKey: "re_test",
          from: "PoolShape <noreply@example.com>",
        },
        send: async (message) => {
          assert.equal(message.to, "designer@example.com");
          assert.equal(message.from, "PoolShape <noreply@example.com>");
          return { id: "msg_1" };
        },
      },
    );
    assert.deepEqual(result, { sent: true, id: "msg_1" });
  });

  it("returns failed when the transport throws", async (t) => {
    t.mock.method(console, "error", () => {});
    const result = await sendMail(
      {
        to: "designer@example.com",
        subject: "Test",
        html: "<p>Hi</p>",
        text: "Hi",
      },
      {
        config: {
          apiKey: "re_test",
          from: "PoolShape <noreply@example.com>",
        },
        send: async () => {
          throw new Error("Resend HTTP 401");
        },
      },
    );
    assert.equal(result.sent, false);
    if (result.sent) throw new Error("expected failure");
    assert.equal(result.reason, "failed");
    assert.equal(result.error, "Resend HTTP 401");
  });
});

describe("isMailConfigured", () => {
  it("requires both key and from", () => {
    assert.equal(isMailConfigured({}), false);
    assert.equal(isMailConfigured({ apiKey: "re_test" }), false);
    assert.equal(
      isMailConfigured({
        apiKey: "re_test",
        from: "PoolShape <noreply@example.com>",
      }),
      true,
    );
  });
});

describe("inviteEmail", () => {
  const acme = inviteEmail({
    inviteeName: "Alex Designer",
    companyName: "Acme Pools",
    roleLabel: "Designer",
    inviteUrl: "https://app.example.com/invite/token-acme",
    temporaryPassword: "TempPass12",
    expiresLabel: "September 12, 2026",
  });
  const other = inviteEmail({
    inviteeName: "Blake",
    companyName: "Gulf Coast Watershapes",
    roleLabel: "Estimator",
    inviteUrl: "https://app.example.com/invite/token-gulf",
    temporaryPassword: "OtherPass9",
    expiresLabel: "September 13, 2026",
  });

  it("includes the invite URL, password, and expiry", () => {
    assert.match(acme.subject, /Acme Pools/);
    assert.match(acme.html, /https:\/\/app\.example\.com\/invite\/token-acme/);
    assert.match(acme.html, /TempPass12/);
    assert.match(acme.html, /September 12, 2026/);
    assert.match(acme.text, /https:\/\/app\.example\.com\/invite\/token-acme/);
    assert.match(acme.text, /TempPass12/);
  });

  it("does not leak another company's name or token", () => {
    assert.doesNotMatch(acme.html, /Gulf Coast Watershapes/);
    assert.doesNotMatch(acme.text, /Gulf Coast Watershapes/);
    assert.doesNotMatch(acme.html, /token-gulf/);
    assert.doesNotMatch(acme.text, /OtherPass9/);
    assert.doesNotMatch(other.html, /Acme Pools/);
    assert.doesNotMatch(other.html, /token-acme/);
  });

  it("escapes HTML in company names", () => {
    const mail = inviteEmail({
      inviteeName: "Alex",
      companyName: `Acme <script>alert("x")</script>`,
      roleLabel: "Designer",
      inviteUrl: "https://app.example.com/invite/t",
      temporaryPassword: "TempPass12",
      expiresLabel: "September 12, 2026",
    });
    assert.doesNotMatch(mail.html, /<script>/);
    assert.match(mail.html, /&lt;script&gt;/);
  });
});

describe("welcomeEmail", () => {
  it("includes the login URL and trial length", () => {
    const mail = welcomeEmail({
      name: "Chris",
      companyName: "Acme Pools",
      loginUrl: "https://app.example.com/login",
      trialDays: 14,
    });
    assert.match(mail.subject, /14-day/);
    assert.match(mail.html, /https:\/\/app\.example\.com\/login/);
    assert.doesNotMatch(mail.html, /Gulf Coast/);
  });
});

describe("resetPasswordEmail", () => {
  it("includes the reset URL and does not leak another user", () => {
    const mail = resetPasswordEmail({
      name: "Alex",
      resetUrl: "https://app.example.com/reset/token-alex",
    });
    assert.match(mail.html, /https:\/\/app\.example\.com\/reset\/token-alex/);
    assert.match(mail.text, /token-alex/);
    assert.doesNotMatch(mail.html, /token-blake/);
  });
});
