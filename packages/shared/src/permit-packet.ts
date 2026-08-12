/**
 * Draft permit packet assembly — advisory plan sheets, not PE-stamped drawings.
 */

import {
  analyzeBarrierCompliance,
  type BarrierReport,
} from "./barrier-checks";
import type { DesignDocument, PointMm } from "./design-model";
import {
  excavationVolumeCy,
  maxDepthMmFromProfile,
  waterVolumeGal,
} from "./depth-profile";
import { computePoolHydraulics } from "./pool-hydraulics";
import { mmToFeet, type UnitSystem } from "./units";
import {
  polygonAreaMm2,
  polygonPerimeterMm,
  waterBodyKind,
} from "./design-model";

export type PermitPacketBodySummary = {
  id: string;
  kind: string;
  areaSf: number;
  perimeterLf: number;
  maxDepthFt: number;
  volumeGal: number;
  excavationCy: number;
};

export type PermitPacket = {
  disclaimer: string;
  generatedAt: string;
  barrier: BarrierReport;
  bodies: PermitPacketBodySummary[];
  hydraulicsNotes: string[];
  buildingCount: number;
  patioCount: number;
  fenceRunCount: number;
  gradeSampleCount: number;
  planOutlineSvg: string;
};

const DISCLAIMER =
  "DRAFT FOR PROFESSIONAL REVIEW ONLY — Not an engineered, stamped, or " +
  "jurisdiction-approved permit set. A licensed PE / drafting professional must " +
  "review setbacks, utilities, structural details, and local AHJ requirements " +
  "before submission.";

function boundsOf(points: PointMm[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY };
}

function collectPlanPoints(design: DesignDocument): PointMm[] {
  const pts: PointMm[] = [];
  for (const b of design.buildings) pts.push(...b.outline);
  for (const p of design.poolBodies) pts.push(...p.outline);
  for (const p of design.patios) pts.push(...p.outline);
  for (const f of design.fences ?? []) pts.push(...f.points);
  for (const g of design.gradeSamples ?? []) pts.push(g.position);
  return pts;
}

function pathD(outline: PointMm[], ox: number, oy: number, scale: number): string {
  if (outline.length < 2) return "";
  return outline
    .map((p, i) => {
      const x = (p.x - ox) * scale;
      const y = (p.y - oy) * scale;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

/** Simple plan SVG for the packet cover sheet. */
export function buildPlanOutlineSvg(design: DesignDocument, size = 640): string {
  const pts = collectPlanPoints(design);
  if (pts.length < 2) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><text x="24" y="40" fill="#666">No geometry yet</text></svg>`;
  }
  const b = boundsOf(pts);
  const pad = 40;
  const w = Math.max(1, b.maxX - b.minX);
  const h = Math.max(1, b.maxY - b.minY);
  const scale = Math.min((size - pad * 2) / w, (size - pad * 2) / h);
  const ox = b.minX - pad / scale;
  const oy = b.minY - pad / scale;

  const layers: string[] = [];
  for (const patio of design.patios) {
    const d = pathD(patio.outline, ox, oy, scale);
    if (d) layers.push(`<path d="${d} Z" fill="#e8e0d4" stroke="#8a7f70" stroke-width="1.2"/>`);
  }
  for (const building of design.buildings) {
    const d = pathD(building.outline, ox, oy, scale);
    if (d) layers.push(`<path d="${d} Z" fill="#d5dde6" stroke="#3d4a57" stroke-width="1.5"/>`);
  }
  for (const body of design.poolBodies) {
    const d = pathD(body.outline, ox, oy, scale);
    const fill = waterBodyKind(body) === "spa" ? "#7eb8d4" : "#4a9ec7";
    if (d) layers.push(`<path d="${d} Z" fill="${fill}" stroke="#1e5f7a" stroke-width="1.5"/>`);
  }
  for (const fence of design.fences ?? []) {
    const d = pathD(fence.points, ox, oy, scale);
    if (d) layers.push(`<path d="${d}" fill="none" stroke="#2c3a33" stroke-width="1.8"/>`);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="background:#faf8f4">${layers.join("")}</svg>`;
}

export function buildPermitPacket(
  design: DesignDocument,
  _unitSystem: UnitSystem = design.unitSystem,
): PermitPacket {
  const bodies: PermitPacketBodySummary[] = design.poolBodies.map((body) => {
    const areaMm2 = polygonAreaMm2(body.outline);
    const perimMm = polygonPerimeterMm(body.outline);
    return {
      id: body.id,
      kind: waterBodyKind(body),
      areaSf: areaMm2 / 92903.04,
      perimeterLf: perimMm / 304.8,
      maxDepthFt: mmToFeet(maxDepthMmFromProfile(body)),
      volumeGal: waterVolumeGal(body),
      excavationCy: excavationVolumeCy(body),
    };
  });

  const hydraulicsNotes: string[] = [];
  for (const body of design.poolBodies) {
    if (waterBodyKind(body) === "spa") continue;
    try {
      const h = computePoolHydraulics(body, design);
      if (h) {
        hydraulicsNotes.push(
          `${body.id}: ~${h.volumeGal.toFixed(0)} gal @ ${h.turnoverHours}h turnover → ${h.designPumpGpm.toFixed(0)} GPM design; ${h.methodNotes.slice(0, 2).join("; ")}`,
        );
      }
    } catch {
      // advisory only
    }
  }

  return {
    disclaimer: DISCLAIMER,
    generatedAt: new Date().toISOString(),
    barrier: analyzeBarrierCompliance(design),
    bodies,
    hydraulicsNotes,
    buildingCount: design.buildings.length,
    patioCount: design.patios.length,
    fenceRunCount: (design.fences ?? []).length,
    gradeSampleCount: (design.gradeSamples ?? []).length,
    planOutlineSvg: buildPlanOutlineSvg(design),
  };
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type PermitDocMeta = {
  companyName: string;
  projectName: string;
  clientName?: string | null;
  address?: string | null;
};

export function buildPermitPacketHtml(
  meta: PermitDocMeta,
  packet: PermitPacket,
): string {
  const bodyRows = packet.bodies
    .map(
      (b) => `<tr>
  <td>${esc(b.kind)} (${esc(b.id)})</td>
  <td>${b.areaSf.toFixed(1)} sf</td>
  <td>${b.perimeterLf.toFixed(1)} lf</td>
  <td>${b.maxDepthFt.toFixed(2)} ft</td>
  <td>${b.volumeGal.toFixed(0)} gal</td>
  <td>${b.excavationCy.toFixed(1)} cy</td>
</tr>`,
    )
    .join("\n");

  const findings = packet.barrier.findings
    .map(
      (f) =>
        `<li><strong>[${esc(f.severity)}]</strong> ${esc(f.message)}</li>`,
    )
    .join("\n");

  const hydro = packet.hydraulicsNotes
    .map((n) => `<li>${esc(n)}</li>`)
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Draft permit packet — ${esc(meta.projectName)}</title>
  <style>
    body { font-family: Georgia, serif; margin: 0; color: #152018; background: #eee; }
    .sheet { max-width: 900px; margin: 0 auto 1.5rem; padding: 1.75rem; background: #fff; page-break-after: always; }
    h1, h2 { font-family: "Fraunces", Georgia, serif; }
    .banner { background: #fff3cd; border: 1px solid #e0c35a; padding: 0.75rem 1rem; font-size: 0.88rem; margin-bottom: 1rem; }
    .muted { color: #5a6a60; }
    table { width: 100%; border-collapse: collapse; margin: 0.75rem 0 1rem; }
    th, td { text-align: left; padding: 0.45rem; border-bottom: 1px solid #d5ddd7; font-size: 0.9rem; }
    .plan { border: 1px solid #ccd5cf; padding: 0.5rem; background: #faf8f4; }
    @media print {
      body { background: #fff; }
      .sheet { box-shadow: none; margin: 0; max-width: none; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <p class="no-print muted">Print → Save as PDF for a multi-page draft packet.</p>
    <div class="banner"><strong>Advisory draft</strong> — ${esc(packet.disclaimer)}</div>
    <h1>Permit plan packet (draft)</h1>
    <p><strong>${esc(meta.companyName)}</strong></p>
    <p>${esc(meta.projectName)}</p>
    <p class="muted">${[meta.clientName, meta.address].filter(Boolean).map(String).map(esc).join(" · ") || "—"}</p>
    <p class="muted">Generated ${esc(new Date(packet.generatedAt).toLocaleString())}</p>
    <h2>Site plan (schematic)</h2>
    <div class="plan">${packet.planOutlineSvg}</div>
  </div>

  <div class="sheet">
    <h2>Water body summary</h2>
    <table>
      <thead>
        <tr>
          <th>Body</th><th>Area</th><th>Perimeter</th><th>Max depth</th><th>Volume</th><th>Excavation</th>
        </tr>
      </thead>
      <tbody>${bodyRows || `<tr><td colspan="6" class="muted">No pools/spas</td></tr>`}</tbody>
    </table>
    <p class="muted">Counts — buildings: ${packet.buildingCount}, patios: ${packet.patioCount},
      fence runs: ${packet.fenceRunCount}, grade samples: ${packet.gradeSampleCount}</p>
    <h2>Hydraulics notes (advisory)</h2>
    <ul>${hydro || "<li class='muted'>No notes</li>"}</ul>
  </div>

  <div class="sheet">
    <h2>Barrier / gate checklist (ISPSC-style, soft)</h2>
    <p class="muted">Overall: ${packet.barrier.ok ? "No blocking findings" : "Review warnings below"}</p>
    <ul>${findings || "<li class='muted'>No findings</li>"}</ul>
    <div class="banner" style="margin-top:1.5rem">${esc(packet.disclaimer)}</div>
  </div>
</body>
</html>`;
}
