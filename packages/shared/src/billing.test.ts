import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  companyHasAppAccess,
  isLocalTrialActive,
  isLocalTrialExpired,
  slugifyCompanyName,
  subscriptionAccessMessage,
  trialDaysRemaining,
  trialEndsAtFrom,
  TRIAL_DURATION_DAYS,
} from "./billing";
import { entitlementsForCompany } from "./entitlements";

const now = new Date("2026-08-14T18:00:00Z");

describe("local trial clock", () => {
  it("is 14 days from start", () => {
    const ends = trialEndsAtFrom(now);
    assert.equal(
      Math.round((ends.getTime() - now.getTime()) / 86400000),
      TRIAL_DURATION_DAYS,
    );
  });

  it("is active until trialEndsAt", () => {
    const company = {
      subscriptionStatus: "trialing",
      trialEndsAt: new Date("2026-08-21T18:00:00Z"),
    };
    assert.equal(isLocalTrialActive(company, now), true);
    assert.equal(isLocalTrialExpired(company, now), false);
    assert.equal(trialDaysRemaining(company, now), 7);
  });

  it("expires when the clock passes trialEndsAt", () => {
    const company = {
      subscriptionStatus: "trialing",
      trialEndsAt: new Date("2026-08-14T17:00:00Z"),
    };
    assert.equal(isLocalTrialActive(company, now), false);
    assert.equal(isLocalTrialExpired(company, now), true);
    assert.equal(companyHasAppAccess(company, now), false);
  });

  it("does not treat a paid company as a trial", () => {
    const company = {
      subscriptionStatus: "active",
      trialEndsAt: null,
      stripeCustomerId: "cus_1",
    };
    assert.equal(isLocalTrialExpired(company, now), false);
    assert.equal(companyHasAppAccess(company, now), true);
  });

  it("unlocks Builder features only while the local trial is active", () => {
    const live = entitlementsForCompany({
      planKey: "starter",
      subscriptionStatus: "trialing",
      trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    assert.equal(live.pdfQuote, true);

    const expired = entitlementsForCompany({
      planKey: "starter",
      subscriptionStatus: "trialing",
      trialEndsAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });
    assert.equal(expired.pdfQuote, false);
  });

  it("explains an expired no-card trial", () => {
    const msg = subscriptionAccessMessage(
      {
        subscriptionStatus: "trialing",
        trialEndsAt: new Date("2026-08-01T18:00:00Z"),
      },
      now,
    );
    assert.match(msg, /trial has ended/i);
  });
});

describe("slugifyCompanyName", () => {
  it("makes a url-safe slug", () => {
    assert.equal(slugifyCompanyName("Acme Pools, LLC"), "acme-pools-llc");
    assert.equal(slugifyCompanyName("  "), "company");
  });
});
