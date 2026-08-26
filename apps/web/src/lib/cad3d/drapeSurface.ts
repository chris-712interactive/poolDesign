import * as THREE from "three";
import {
  flattenClosedOutline,
  mmToMeters,
  type PointMm,
} from "@pool-design/shared";

export type DrapedTris = {
  positions: number[];
  uvs: number[];
  indices: number[];
};

function ringPts(outlineMm: PointMm[]): PointMm[] {
  if (outlineMm.length < 3) return outlineMm;
  const first = outlineMm[0];
  const last = outlineMm[outlineMm.length - 1];
  if (Math.hypot(first.x - last.x, first.y - last.y) < 1) {
    return outlineMm.slice(0, -1);
  }
  return outlineMm;
}

function densifyRing(ring: PointMm[], stepMm: number): PointMm[] {
  const pts = ringPts(ring);
  if (pts.length < 3) return pts;
  const out: PointMm[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const segs = Math.max(1, Math.ceil(len / Math.max(40, stepMm)));
    for (let s = 0; s < segs; s++) {
      const t = s / segs;
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return out;
}

function signedAreaMm2(ring: PointMm[]): number {
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i];
    const q = ring[(i + 1) % ring.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

function trace(
  path: THREE.Path,
  outlineMm: PointMm[],
  clockwise: boolean,
): void {
  let pts = densifyRing(flattenClosedOutline(ringPts(outlineMm)), 320);
  if (pts.length < 3) return;
  const cw = signedAreaMm2(pts) < 0;
  if (cw !== clockwise) pts = [...pts].reverse();
  const first = pts[0];
  path.moveTo(mmToMeters(-first.x), mmToMeters(first.y));
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i];
    path.lineTo(mmToMeters(-p.x), mmToMeters(p.y));
  }
  path.closePath();
}

function toPath(outlineMm: PointMm[], clockwise: boolean): THREE.Path {
  const path = new THREE.Path();
  trace(path, outlineMm, clockwise);
  return path;
}

function toShape(outlineMm: PointMm[], clockwise: boolean): THREE.Shape {
  const shape = new THREE.Shape();
  trace(shape, outlineMm, clockwise);
  return shape;
}

function tessellate(geo: THREE.BufferGeometry, maxEdgeM: number): THREE.BufferGeometry {
  const src = geo.attributes.position;
  if (!src || src.count < 3) return geo;
  const verts: number[] = [];
  for (let i = 0; i < src.count; i++) {
    verts.push(src.getX(i), src.getY(i), src.getZ(i));
  }
  let tris: number[] = [];
  const idx = geo.index;
  if (idx) {
    for (let i = 0; i < idx.count; i++) tris.push(idx.getX(i));
  } else {
    for (let i = 0; i < src.count; i++) tris.push(i);
  }
  const key = (a: number, b: number) => (a < b ? `${a}_${b}` : `${b}_${a}`);
  const dist = (a: number, b: number) =>
    Math.hypot(
      verts[a * 3] - verts[b * 3],
      verts[a * 3 + 1] - verts[b * 3 + 1],
      verts[a * 3 + 2] - verts[b * 3 + 2],
    );

  for (let pass = 0; pass < 16; pass++) {
    const mids = new Map<string, number>();
    const midpoint = (a: number, b: number) => {
      const k = key(a, b);
      const hit = mids.get(k);
      if (hit != null) return hit;
      const i = verts.length / 3;
      verts.push(
        (verts[a * 3] + verts[b * 3]) * 0.5,
        (verts[a * 3 + 1] + verts[b * 3 + 1]) * 0.5,
        (verts[a * 3 + 2] + verts[b * 3 + 2]) * 0.5,
      );
      mids.set(k, i);
      return i;
    };
    let split = false;
    const next: number[] = [];
    for (let t = 0; t < tris.length; t += 3) {
      const a = tris[t];
      const b = tris[t + 1];
      const c = tris[t + 2];
      const ab = dist(a, b);
      const bc = dist(b, c);
      const ca = dist(c, a);
      const longest = Math.max(ab, bc, ca);
      if (longest <= maxEdgeM) {
        next.push(a, b, c);
        continue;
      }
      split = true;
      if (ab >= bc && ab >= ca) {
        const m = midpoint(a, b);
        next.push(a, m, c, m, b, c);
      } else if (bc >= ca) {
        const m = midpoint(b, c);
        next.push(a, b, m, a, m, c);
      } else {
        const m = midpoint(c, a);
        next.push(a, b, m, b, c, m);
      }
    }
    tris = next;
    if (!split) break;
  }

  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  out.setIndex(tris);
  geo.dispose();
  return out;
}

/**
 * Tessellate a plan polygon (true outline, not a grid) and lift each vertex
 * onto sampled grade so the bed follows the lawn without sawtooth edges.
 */
export function drapePlanPolygon(
  outline: PointMm[],
  hole: PointMm[] | undefined,
  gradeY: (plan: PointMm) => number,
  liftM: number,
): DrapedTris | null {
  if (outline.length < 3) return null;
  const shape = toShape(outline, false);
  if (hole && hole.length >= 3) {
    shape.holes.push(toPath(hole, true));
  }
  let geo: THREE.BufferGeometry;
  try {
    geo = tessellate(new THREE.ShapeGeometry(shape), 0.38);
  } catch {
    return null;
  }
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const idx = geo.index;
  if (!pos || !idx || idx.count < 3) {
    geo.dispose();
    return null;
  }

  const positions: number[] = [];
  const uvs: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const plan = { x: -x * 1000, y: -z * 1000 };
    const y = gradeY(plan) + liftM;
    positions.push(x, y, z);
    uvs.push(x, z);
  }
  const indices: number[] = [];
  for (let i = 0; i < idx.count; i++) indices.push(idx.getX(i));

  // Ensure faces point up after the XZ lift.
  if (indices.length >= 3) {
    const ia = indices[0];
    const ib = indices[1];
    const ic = indices[2];
    const ax = positions[ia * 3];
    const ay = positions[ia * 3 + 1];
    const az = positions[ia * 3 + 2];
    const bx = positions[ib * 3];
    const by = positions[ib * 3 + 1];
    const bz = positions[ib * 3 + 2];
    const cx = positions[ic * 3];
    const cy = positions[ic * 3 + 1];
    const cz = positions[ic * 3 + 2];
    const ny =
      (by - ay) * (cz - az) - (bz - az) * (cy - ay);
    if (ny < 0) {
      for (let t = 0; t < indices.length; t += 3) {
        const tmp = indices[t + 1];
        indices[t + 1] = indices[t + 2];
        indices[t + 2] = tmp;
      }
    }
  }

  geo.dispose();
  return { positions, uvs, indices };
}
