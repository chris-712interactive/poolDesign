import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { presentationCameraToPose } from "./presentation-camera";
import { mmToMeters } from "./scene3d";
import { DEFAULT_PRESENTATION_LOOK_DISTANCE_MM } from "./design-model";

describe("presentationCameraToPose", () => {
  it("places the eye at the plan marker and looks along 0° (drawing-up / +Z)", () => {
    const pose = presentationCameraToPose({
      id: "cam_1",
      name: "House",
      position: { x: 0, y: 0 },
      rotationDeg: 0,
      sortIndex: 0,
      lookDistanceMm: DEFAULT_PRESENTATION_LOOK_DISTANCE_MM,
    });
    assert.ok(Math.abs(pose.position[0]) < 1e-12);
    assert.ok(Math.abs(pose.position[2]) < 1e-12);
    assert.ok(pose.position[1] > 1.4);
    assert.ok(Math.abs(pose.target[0]) < 1e-9);
    assert.ok(
      Math.abs(pose.target[2] - mmToMeters(DEFAULT_PRESENTATION_LOOK_DISTANCE_MM)) <
        1e-6,
    );
  });
});
