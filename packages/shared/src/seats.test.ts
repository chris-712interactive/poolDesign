import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  alsoDesignerFromGrants,
  designerSeatCapacity,
  extraDesignerSeatsNeeded,
  primaryRoleFromGrants,
  userHasLicensedDesignerSeat,
} from "./seats";

describe("designer seats", () => {
  it("includes one seat then counts paid extras", () => {
    assert.equal(designerSeatCapacity(0), 1);
    assert.equal(designerSeatCapacity(2), 3);
    assert.equal(extraDesignerSeatsNeeded(1), 0);
    assert.equal(extraDesignerSeatsNeeded(3), 2);
  });

  it("licenses oldest designer grants first", () => {
    const ids = ["a", "b", "c"];
    assert.equal(
      userHasLicensedDesignerSeat({
        userId: "a",
        designerUserIdsOldestFirst: ids,
        paidExtraSeats: 0,
      }),
      true,
    );
    assert.equal(
      userHasLicensedDesignerSeat({
        userId: "b",
        designerUserIdsOldestFirst: ids,
        paidExtraSeats: 0,
      }),
      false,
    );
    assert.equal(
      userHasLicensedDesignerSeat({
        userId: "b",
        designerUserIdsOldestFirst: ids,
        paidExtraSeats: 1,
      }),
      true,
    );
    assert.equal(
      userHasLicensedDesignerSeat({
        userId: "c",
        designerUserIdsOldestFirst: ids,
        paidExtraSeats: 1,
      }),
      false,
    );
  });
});

describe("role grants", () => {
  it("picks the primary login role", () => {
    assert.equal(primaryRoleFromGrants(["estimator", "designer"]), "designer");
    assert.equal(
      primaryRoleFromGrants(["designer", "company_admin"]),
      "company_admin",
    );
    assert.equal(alsoDesignerFromGrants(["company_admin", "designer"]), true);
    assert.equal(alsoDesignerFromGrants(["designer"]), false);
  });
});
