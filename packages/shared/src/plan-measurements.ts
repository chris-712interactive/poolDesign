import type { DesignDocument, PointMm, PoolBody } from "./design-model";
import {
  approximateIntersectionAreaMm2,
  fenceBillableLengthMm,
  fenceKindLabel,
  gateKindLabel,
  polygonAreaMm2,
  polygonPerimeterMm,
  polylineLengthMm,
  segmentLengthMm,
  waterBodyKind,
} from "./design-model";
import {
  bodyWallThicknessMm,
  insideRectangleSize,
  rectangleFrame,
} from "./spa-defaults";
import { insetClosedOutline } from "./scene3d";
import {
  getPatioFinish,
  PATIO_FINISH_CATEGORY_LABELS,
  PATIO_FINISH_PATTERN_LABELS,
  type PatioFinishCategory,
} from "./patio-finishes";
import { siteLineKindLabel, siteLineLengthMm } from "./site-lines";
import {
  analyzeDesignGrade,
  totalFillCy,
  totalRetainingLf,
} from "./site-grade";
import { waterVolumeGal } from "./depth-profile";
import { formatArea, formatLength, type UnitSystem } from "./units";

export type PlanMeasurementUnit =
  | "length"
  | "area"
  | "volume_gal"
  | "volume_cy"
  | "count";

export type PlanMeasurementRow = {
  id: string;
  label: string;
  quantity: number;
  unit: PlanMeasurementUnit;
  note?: string;
};

export type PlanMeasurementGroup = {
  id: string;
  title: string;
  rows: PlanMeasurementRow[];
};

const EPS_MM = 1;
const EPS_MM2 = 100;

function longestEdgeMm(outline: PointMm[]): number {
  if (outline.length < 2) return 0;
  let max = 0;
  for (let i = 0; i < outline.length; i++) {
    max = Math.max(
      max,
      segmentLengthMm(outline[i], outline[(i + 1) % outline.length]),
    );
  }
  return max;
}

function pushLength(
  rows: PlanMeasurementRow[],
  id: string,
  label: string,
  mm: number,
  note?: string,
) {
  if (!(mm > EPS_MM)) return;
  rows.push({ id, label, quantity: mm, unit: "length", note });
}

function pushArea(
  rows: PlanMeasurementRow[],
  id: string,
  label: string,
  mm2: number,
  note?: string,
) {
  if (!(mm2 > EPS_MM2)) return;
  rows.push({ id, label, quantity: mm2, unit: "area", note });
}

function circuitLabel(circuit: string): string {
  if (circuit === "suction") return "Suction";
  if (circuit === "return") return "Return";
  if (circuit === "gas") return "Gas";
  return "Other";
}

function featureKindLabel(kind: string): string {
  if (kind === "bench") return "Bench";
  if (kind === "steps") return "Steps";
  if (kind === "sunshelf") return "Sunshelf";
  return kind;
}

function patioNetAreaMm2(patioOutline: PointMm[], holes: PointMm[][]): number {
  const gross = polygonAreaMm2(patioOutline);
  let punched = 0;
  for (const hole of holes) {
    punched += approximateIntersectionAreaMm2(patioOutline, hole);
  }
  return Math.max(0, gross - punched);
}

function waterBodyRows(body: PoolBody): PlanMeasurementRow[] {
  const rows: PlanMeasurementRow[] = [];
  const kind = waterBodyKind(body);
  const wall = bodyWallThicknessMm(body);
  const outside = body.outline;
  const inside = insetClosedOutline(outside, wall);
  const frame = rectangleFrame(outside);
  const insideSize = insideRectangleSize(outside, wall);

  if (frame) {
    pushLength(rows, `${body.id}-out-w`, "Outside width", frame.widthMm);
    pushLength(rows, `${body.id}-out-l`, "Outside length", frame.lengthMm);
  }
  if (insideSize) {
    pushLength(rows, `${body.id}-in-w`, "Inside width (waterline)", insideSize.widthMm);
    pushLength(rows, `${body.id}-in-l`, "Inside length (waterline)", insideSize.lengthMm);
  }
  pushLength(
    rows,
    `${body.id}-out-p`,
    "Outside perimeter",
    polygonPerimeterMm(outside),
  );
  pushLength(
    rows,
    `${body.id}-in-p`,
    "Waterline perimeter",
    polygonPerimeterMm(inside),
  );
  pushArea(
    rows,
    `${body.id}-out-a`,
    "Outside footprint",
    polygonAreaMm2(outside),
  );
  pushArea(
    rows,
    `${body.id}-in-a`,
    kind === "spa" ? "Water surface" : "Water surface",
    polygonAreaMm2(inside),
  );
  pushLength(rows, `${body.id}-wall`, "Wall thickness", wall);
  const gal = waterVolumeGal(body);
  if (gal > 0.5) {
    rows.push({
      id: `${body.id}-gal`,
      label: "Water volume",
      quantity: gal,
      unit: "volume_gal",
    });
  }
  return rows;
}

function featureRows(
  design: DesignDocument,
  bodyId: string | undefined,
): PlanMeasurementRow[] {
  const rows: PlanMeasurementRow[] = [];
  const features = (design.features ?? []).filter((f) =>
    bodyId ? f.poolBodyId === bodyId : !f.poolBodyId,
  );
  for (const feat of features) {
    const kind = featureKindLabel(feat.kind);
    const prefix = `${feat.id}`;
    pushLength(
      rows,
      `${prefix}-p`,
      `${feat.name || kind} perimeter`,
      polygonPerimeterMm(feat.outline),
    );
    pushLength(
      rows,
      `${prefix}-face`,
      `${feat.name || kind} longest side`,
      longestEdgeMm(feat.outline),
    );
    pushArea(
      rows,
      `${prefix}-a`,
      `${feat.name || kind} area`,
      polygonAreaMm2(feat.outline),
    );
    if (feat.kind === "steps" && feat.riserCount && feat.riserCount > 0) {
      rows.push({
        id: `${prefix}-risers`,
        label: `${feat.name || kind} risers`,
        quantity: feat.riserCount,
        unit: "count",
      });
    }
  }
  return rows;
}

/**
 * Designer-facing quantity schedule from the current plan geometry.
 * Lengths are mm, areas mm², volumes gallons or cubic yards.
 */
export function buildPlanMeasurements(
  design: DesignDocument,
  unitSystem: UnitSystem = design.unitSystem,
): PlanMeasurementGroup[] {
  const groups: PlanMeasurementGroup[] = [];
  const holes = design.poolBodies.map((b) => b.outline);

  for (const body of design.poolBodies) {
    const kind = waterBodyKind(body) === "spa" ? "Spa" : "Pool";
    const rows = [
      ...waterBodyRows(body),
      ...featureRows(design, body.id),
    ];
    if (rows.length === 0) continue;
    groups.push({
      id: `body-${body.id}`,
      title: `${kind} · ${body.name}`,
      rows,
    });
  }

  const orphanFeatures = featureRows(design, undefined);
  if (orphanFeatures.length > 0) {
    groups.push({
      id: "features",
      title: "Other features",
      rows: orphanFeatures,
    });
  }

  const patioCategoryTotals = new Map<
    PatioFinishCategory,
    { areaMm2: number; count: number }
  >();
  for (const patio of design.patios ?? []) {
    const finish = getPatioFinish(patio.materialId);
    const gross = polygonAreaMm2(patio.outline);
    const net = patioNetAreaMm2(patio.outline, holes);
    const rows: PlanMeasurementRow[] = [];
    pushArea(rows, `${patio.id}-gross`, "Gross area (including water)", gross);
    pushArea(
      rows,
      `${patio.id}-net`,
      `Paving area (${PATIO_FINISH_CATEGORY_LABELS[finish.category].toLowerCase()})`,
      net,
      `${finish.name} · ${PATIO_FINISH_PATTERN_LABELS[finish.pattern]}`,
    );
    pushLength(
      rows,
      `${patio.id}-p`,
      "Perimeter",
      polygonPerimeterMm(patio.outline),
    );
    if (rows.length > 0) {
      groups.push({
        id: `patio-${patio.id}`,
        title: `Patio · ${patio.name}`,
        rows,
      });
    }
    const prev = patioCategoryTotals.get(finish.category) ?? {
      areaMm2: 0,
      count: 0,
    };
    patioCategoryTotals.set(finish.category, {
      areaMm2: prev.areaMm2 + net,
      count: prev.count + 1,
    });
  }
  if (patioCategoryTotals.size > 0) {
    const rows: PlanMeasurementRow[] = [];
    for (const category of ["concrete", "paver", "stone"] as const) {
      const tot = patioCategoryTotals.get(category);
      if (!tot) continue;
      pushArea(
        rows,
        `patio-tot-${category}`,
        `${PATIO_FINISH_CATEGORY_LABELS[category]} total`,
        tot.areaMm2,
        tot.count === 1 ? "1 patio" : `${tot.count} patios`,
      );
    }
    if (rows.length > 0) {
      groups.push({
        id: "patio-totals",
        title: "Patio totals by finish",
        rows,
      });
    }
  }

  const covers = design.patioCovers ?? [];
  if (covers.length > 0) {
    const rows: PlanMeasurementRow[] = [];
    for (const cover of covers) {
      const kind = cover.kind === "roof" ? "Patio roof" : "Pergola";
      pushArea(
        rows,
        `${cover.id}-a`,
        `${cover.name || kind} area`,
        polygonAreaMm2(cover.outline),
      );
      pushLength(
        rows,
        `${cover.id}-p`,
        `${cover.name || kind} perimeter`,
        polygonPerimeterMm(cover.outline),
      );
    }
    if (rows.length > 0) {
      groups.push({ id: "covers", title: "Covers", rows });
    }
  }

  const runs = design.plumbingRuns ?? [];
  if (runs.length > 0) {
    const rows: PlanMeasurementRow[] = [];
    const byCircuit = new Map<string, number>();
    for (const run of runs) {
      const len = polylineLengthMm(run.points);
      const circuit = circuitLabel(run.circuit);
      pushLength(
        rows,
        `${run.id}-l`,
        run.name || `${circuit} run`,
        len,
        run.pipeDiameterMm
          ? `${circuit} · ${formatLength(run.pipeDiameterMm, unitSystem)} pipe`
          : circuit,
      );
      byCircuit.set(run.circuit, (byCircuit.get(run.circuit) ?? 0) + len);
    }
    for (const [circuit, mm] of byCircuit) {
      pushLength(
        rows,
        `plumb-tot-${circuit}`,
        `${circuitLabel(circuit)} total`,
        mm,
      );
    }
    const all = [...byCircuit.values()].reduce((s, n) => s + n, 0);
    pushLength(rows, "plumb-tot", "All plumbing", all);
    if (rows.length > 0) {
      groups.push({ id: "plumbing", title: "Plumbing", rows });
    }
  }

  const fences = design.fences ?? [];
  if (fences.length > 0) {
    const rows: PlanMeasurementRow[] = [];
    let total = 0;
    for (const fence of fences) {
      const mm = fenceBillableLengthMm(fence);
      total += mm;
      pushLength(
        rows,
        `${fence.id}-l`,
        fence.name || "Fence",
        mm,
        fenceKindLabel(fence.kind),
      );
      for (const gate of fence.gates ?? []) {
        pushLength(
          rows,
          `${gate.id}-w`,
          `${gateKindLabel(gate.kind)} gate`,
          gate.widthMm,
          fence.name,
        );
      }
    }
    pushLength(rows, "fence-tot", "Fence total (less gates)", total);
    if (rows.length > 0) {
      groups.push({ id: "fence", title: "Fence", rows });
    }
  }

  for (const building of design.buildings ?? []) {
    const rows: PlanMeasurementRow[] = [];
    pushArea(
      rows,
      `${building.id}-a`,
      "Footprint",
      polygonAreaMm2(building.outline),
    );
    pushLength(
      rows,
      `${building.id}-p`,
      "Perimeter",
      polygonPerimeterMm(building.outline),
    );
    const stories = Math.max(1, building.stories || 1);
    if (stories > 1) {
      rows.push({
        id: `${building.id}-stories`,
        label: "Stories",
        quantity: stories,
        unit: "count",
      });
    }
    if (rows.length > 0) {
      groups.push({
        id: `house-${building.id}`,
        title: `House · ${building.name}`,
        rows,
      });
    }
  }

  const siteLines = design.siteLines ?? [];
  if (siteLines.length > 0) {
    const rows: PlanMeasurementRow[] = [];
    for (const line of siteLines) {
      pushLength(
        rows,
        `${line.id}-l`,
        line.name || siteLineKindLabel(line.kind),
        siteLineLengthMm(line),
        siteLineKindLabel(line.kind),
      );
    }
    if (rows.length > 0) {
      groups.push({ id: "site", title: "Lot lines", rows });
    }
  }

  const gradeAnalyses = analyzeDesignGrade(
    design.patios ?? [],
    design.gradeSamples ?? [],
    design.gradeOptions,
  );
  const fillCy = totalFillCy(gradeAnalyses);
  const retainingLf = totalRetainingLf(gradeAnalyses);
  const gradeRows: PlanMeasurementRow[] = [];
  if (fillCy > 0.01) {
    gradeRows.push({
      id: "grade-fill",
      label: "Patio fill",
      quantity: fillCy,
      unit: "volume_cy",
      note: "Compacted fill to house FFE",
    });
  }
  if (retainingLf > 0.01) {
    gradeRows.push({
      id: "grade-retaining",
      label: "Retaining length",
      quantity: retainingLf * 304.8,
      unit: "length",
      note: "Patio edges over the drop threshold",
    });
  }
  if (gradeRows.length > 0) {
    groups.push({ id: "grade", title: "Grade", rows: gradeRows });
  }

  return groups;
}

export function formatPlanMeasurement(
  row: PlanMeasurementRow,
  unitSystem: UnitSystem,
): string {
  switch (row.unit) {
    case "length":
      return formatLength(row.quantity, unitSystem);
    case "area":
      return formatArea(row.quantity, unitSystem);
    case "volume_gal":
      if (unitSystem === "metric") {
        return `${Math.round(row.quantity * 3.78541).toLocaleString()} L`;
      }
      return `${Math.round(row.quantity).toLocaleString()} gal`;
    case "volume_cy":
      if (unitSystem === "metric") {
        return `${(row.quantity * 0.764555).toFixed(2)} m³`;
      }
      return `${row.quantity.toFixed(2)} cy`;
    case "count":
      return String(Math.round(row.quantity));
  }
}

export function planMeasurementsPlainText(
  groups: PlanMeasurementGroup[],
  unitSystem: UnitSystem,
): string {
  const lines: string[] = [];
  for (const group of groups) {
    lines.push(group.title);
    for (const row of group.rows) {
      const note = row.note ? `  (${row.note})` : "";
      lines.push(
        `  ${row.label}\t${formatPlanMeasurement(row, unitSystem)}${note}`,
      );
    }
    lines.push("");
  }
  return lines.join("\n").trim();
}
