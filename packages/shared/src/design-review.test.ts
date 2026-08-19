import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyClientReview,
  applyDesignerRequestApproval,
  clientCanApprove,
  parseDesignStatus,
  parseReviewKind,
  reviewNoteOk,
} from "./design-review";

describe("design review workflow", () => {
  it("shows Approve only when the designer asks for sign-off", () => {
    assert.equal(
      clientCanApprove({
        requestClientApproval: true,
        designStatus: "awaiting_approval",
      }),
      true,
    );
    assert.equal(
      clientCanApprove({
        requestClientApproval: false,
        designStatus: "in_design",
      }),
      false,
    );
    assert.equal(
      clientCanApprove({
        requestClientApproval: true,
        designStatus: "approved",
      }),
      false,
    );
  });

  it("approval closes the request and marks the job approved", () => {
    assert.deepEqual(applyClientReview("approved"), {
      designStatus: "approved",
      requestClientApproval: false,
    });
  });

  it("change requests reopen design work and hide Approve", () => {
    assert.deepEqual(applyClientReview("changes_requested"), {
      designStatus: "changes_requested",
      requestClientApproval: false,
    });
  });

  it("designer opt-in sets awaiting approval", () => {
    assert.deepEqual(applyDesignerRequestApproval(true, "in_design"), {
      designStatus: "awaiting_approval",
      requestClientApproval: true,
    });
    assert.deepEqual(applyDesignerRequestApproval(false, "awaiting_approval"), {
      designStatus: "in_design",
      requestClientApproval: false,
    });
    assert.deepEqual(applyDesignerRequestApproval(false, "approved"), {
      designStatus: "approved",
      requestClientApproval: false,
    });
  });

  it("requires a note or voice for change requests", () => {
    assert.equal(reviewNoteOk("changes_requested", "", false), false);
    assert.equal(reviewNoteOk("changes_requested", "move spa", false), true);
    assert.equal(reviewNoteOk("changes_requested", "", true), true);
    assert.equal(reviewNoteOk("approved", "", false), true);
  });

  it("parses known statuses and kinds", () => {
    assert.equal(parseDesignStatus("approved"), "approved");
    assert.equal(parseDesignStatus("nope"), "in_design");
    assert.equal(parseReviewKind("changes_requested"), "changes_requested");
    assert.equal(parseReviewKind("rejected"), null);
  });
});
