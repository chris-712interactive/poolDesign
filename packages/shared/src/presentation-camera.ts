import {
  presentationEyeHeightMm,
  presentationLookDistanceMm,
  type GradeSample,
  type PresentationCamera,
} from "./design-model";
import { bearingToUnitVector } from "./grade-walk";
import { mmToMeters, planToWorldXZ } from "./scene3d";
import { existingGradeDropMm } from "./site-grade";

export type PresentationCameraPose = {
  position: [number, number, number];
  target: [number, number, number];
};

/**
 * Orbit starting pose: eye at the plan marker, looking along its heading.
 * OrbitControls stay free after this pose is applied.
 */
export function presentationCameraToPose(
  cam: PresentationCamera,
  gradeSamples: GradeSample[] = [],
): PresentationCameraPose {
  const heading = bearingToUnitVector(cam.rotationDeg || 0);
  const lookMm = presentationLookDistanceMm(cam);
  const eyeMm = presentationEyeHeightMm(cam);
  const lookPlan = {
    x: cam.position.x + heading.x * lookMm,
    y: cam.position.y + heading.y * lookMm,
  };
  const eye = planToWorldXZ(cam.position);
  const look = planToWorldXZ(lookPlan);
  const eyeY =
    -mmToMeters(existingGradeDropMm(cam.position, gradeSamples)) +
    mmToMeters(eyeMm);
  const targetY =
    -mmToMeters(existingGradeDropMm(lookPlan, gradeSamples)) + 0.9;
  return {
    position: [eye.x, eyeY, eye.z],
    target: [look.x, targetY, look.z],
  };
}
