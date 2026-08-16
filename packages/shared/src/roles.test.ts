import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canUseCad, needsCompanySetup } from "./roles";

describe("canUseCad", () => {
  it("allows designers", () => {
    assert.equal(canUseCad("designer"), true);
  });

  it("allows company admins only when they take a designer seat", () => {
    assert.equal(canUseCad("company_admin"), false);
    assert.equal(canUseCad("company_admin", true), true);
  });

  it("blocks estimators", () => {
    assert.equal(canUseCad("estimator"), false);
    assert.equal(canUseCad("estimator", true), false);
  });
});

describe("needsCompanySetup", () => {
  it("sends new company admins through setup", () => {
    assert.equal(
      needsCompanySetup({ role: "company_admin", company: { setupCompletedAt: null } }),
      true,
    );
  });

  it("skips designers and completed companies", () => {
    assert.equal(
      needsCompanySetup({ role: "designer", company: { setupCompletedAt: null } }),
      false,
    );
    assert.equal(
      needsCompanySetup({
        role: "company_admin",
        company: { setupCompletedAt: new Date().toISOString() },
      }),
      false,
    );
  });
});
