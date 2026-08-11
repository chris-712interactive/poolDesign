/**
 * Soft ISPSC-style barrier / gate checks for residential pool plans.
 * Advisory only — not a substitute for local AHJ / PE review.
 */

import type { DesignDocument, FenceRun, PointMm } from "./design-model";
import {
  defaultFenceHeightMm,
  pointInPolygon,
  polygonAreaMm2,
  waterBodyKind,
} from "./design-model";
import { MM_PER_FOOT, MM_PER_INCH } from "./units";

/** Typical residential barrier minimum (ISPSC often 48″). */
export const ISPSC_MIN_BARRIER_HEIGHT_MM = 48 * MM_PER_INCH;

/** Preferred residential barrier height many jurisdictions use (60″). */
export const PREFERRED_BARRIER_HEIGHT_MM = 60 * MM_PER_INCH;

export type BarrierFinding = {
  id: string;
  severity: "info" | "warn" | "ok";
  message: string;
};

export type BarrierReport = {
  findings: BarrierFinding[];
  hasFence: boolean;
  hasGate: boolean;
  allFencesMeetMinHeight: boolean;
  ok: boolean;
};

function fenceHeightMm(fence: FenceRun): number {
  return fence.heightMm != null &&
    Number.isFinite(fence.heightMm) &&
    fence.heightMm > 0
    ? fence.heightMm
    : defaultFenceHeightMm(fence.kind);
}

function openRing(points: PointMm[]): PointMm[] {
  if (points.length < 2) return points;
  const a = points[0];
  const b = points[points.length - 1];
  if (Math.hypot(a.x - b.x, a.y - b.y) < 1) return points.slice(0, -1);
  return points;
}

/** True when a closed fence polyline fully contains every pool/spa outline. */
export function fenceEnclosesWaterBodies(
  design: DesignDocument,
): boolean {
  const fences = design.fences ?? [];
  const bodies = design.poolBodies.filter((b) => b.outline.length >= 3);
  if (!bodies.length || !fences.length) return false;

  for (const body of bodies) {
    const pts = openRing(body.outline);
    let enclosed = false;
    for (const fence of fences) {
      const ring = openRing(fence.points);
      if (ring.length < 3) continue;
      // Fence must be a closed loop (first≈last or treat as open = fail).
      const closed =
        fence.points.length >= 4 &&
        Math.hypot(
          fence.points[0].x - fence.points[fence.points.length - 1].x,
          fence.points[0].y - fence.points[fence.points.length - 1].y,
        ) < 200;
      if (!closed && ring.length >= 3) {
        // Allow nearly-closed polylines by closing synthetically for the test.
      }
      const testRing =
        Math.hypot(
          ring[0].x - ring[ring.length - 1].x,
          ring[0].y - ring[ring.length - 1].y,
        ) > 50
          ? [...ring, ring[0]]
          : ring;
      if (polygonAreaMm2(testRing) < 1) continue;
      if (pts.every((p) => pointInPolygon(p, testRing))) {
        enclosed = true;
        break;
      }
    }
    if (!enclosed) return false;
  }
  return true;
}

/**
 * Soft barrier compliance report for the design checklist / properties panel.
 */
export function analyzeBarrierCompliance(
  design: DesignDocument,
): BarrierReport {
  const findings: BarrierFinding[] = [];
  const fences = design.fences ?? [];
  const hasPool = design.poolBodies.some(
    (b) => waterBodyKind(b) === "pool" || waterBodyKind(b) === "spa",
  );

  if (!hasPool) {
    return {
      findings: [
        {
          id: "no_pool",
          severity: "info",
          message: "No pool/spa yet — barrier checks apply once water is drawn.",
        },
      ],
      hasFence: false,
      hasGate: false,
      allFencesMeetMinHeight: true,
      ok: true,
    };
  }

  const hasFence = fences.length > 0;
  const hasGate = fences.some((f) => (f.gates ?? []).length > 0);

  if (!hasFence) {
    findings.push({
      id: "missing_fence",
      severity: "warn",
      message:
        "No barrier fence on plan. ISPSC typically requires a 48″+ isolation barrier (or house-as-barrier with alarms).",
    });
  } else {
    findings.push({
      id: "has_fence",
      severity: "ok",
      message: `${fences.length} fence run(s) on plan.`,
    });
  }

  if (hasFence && !hasGate) {
    findings.push({
      id: "missing_gate",
      severity: "warn",
      message:
        "Fence has no gate. Add a self-closing / self-latching gate for code egress.",
    });
  } else if (hasGate) {
    findings.push({
      id: "has_gate",
      severity: "ok",
      message: "At least one gate is placed — verify self-close / latch in field.",
    });
  }

  let allFencesMeetMinHeight = true;
  for (const fence of fences) {
    const h = fenceHeightMm(fence);
    if (h + 1 < ISPSC_MIN_BARRIER_HEIGHT_MM) {
      allFencesMeetMinHeight = false;
      findings.push({
        id: `height_${fence.id}`,
        severity: "warn",
        message: `${fence.name || "Fence"} is ${(h / MM_PER_INCH).toFixed(0)}″ — below common 48″ ISPSC minimum.`,
      });
    } else if (h + 1 < PREFERRED_BARRIER_HEIGHT_MM && fence.kind !== "glass") {
      findings.push({
        id: `height_pref_${fence.id}`,
        severity: "info",
        message: `${fence.name || "Fence"} is ${(h / MM_PER_INCH).toFixed(0)}″ — many AHJs prefer 60″ for non-glass barriers.`,
      });
    }
  }

  if (hasFence) {
    const enclosed = fenceEnclosesWaterBodies(design);
    if (enclosed) {
      findings.push({
        id: "enclosed",
        severity: "ok",
        message: "A closed fence loop appears to enclose all water bodies.",
      });
    } else {
      findings.push({
        id: "not_enclosed",
        severity: "warn",
        message:
          "Fence does not fully enclose pool/spa (or is an open run). Close the loop or document house-as-barrier.",
      });
    }
  }

  const ok = !findings.some((f) => f.severity === "warn");
  return {
    findings,
    hasFence,
    hasGate,
    allFencesMeetMinHeight,
    ok,
  };
}

/** Format height for notes. */
export function barrierMinHeightLabel(): string {
  return `${ISPSC_MIN_BARRIER_HEIGHT_MM / MM_PER_INCH}" (${(ISPSC_MIN_BARRIER_HEIGHT_MM / MM_PER_FOOT).toFixed(1)}')`;
}
