import { NextResponse } from "next/server";
import { prisma } from "@pool-design/db";
import {
  gradeWalkToSamples,
  mergeGradeWalkSamples,
  normalizeDesignDocument,
  parseDesignDocument,
  type DesignLevel,
  type GradeSample,
  type PointMm,
} from "@pool-design/shared";
import { getSessionUser } from "@/lib/auth";
import { requireEntitlement } from "@/lib/subscription";

type Body = {
  origin: PointMm;
  bearingDeg: number;
  points: Array<{ distanceMm: number; dropMm: number }>;
  replaceExisting?: boolean;
  /** When true, persist samples onto the project design. */
  apply?: boolean;
};

/**
 * Convert an AR / phone grade walk into GradeSample points.
 * Optionally merges into the saved design.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user?.companyId || !user.company) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const gate = requireEntitlement(user.company, "arGradeImport");
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const { id } = await context.params;
  const project = await prisma.project.findFirst({
    where: { id, companyId: user.companyId },
  });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as Body | null;
  if (
    !body?.origin ||
    !Number.isFinite(body.origin.x) ||
    !Number.isFinite(body.origin.y) ||
    !Number.isFinite(body.bearingDeg) ||
    !Array.isArray(body.points) ||
    body.points.length === 0
  ) {
    return NextResponse.json(
      {
        error:
          "Expected { origin: {x,y}, bearingDeg, points: [{ distanceMm, dropMm }, ...] }",
      },
      { status: 400 },
    );
  }

  const imported = gradeWalkToSamples({
    origin: body.origin,
    bearingDeg: body.bearingDeg,
    points: body.points,
  });

  if (!body.apply) {
    return NextResponse.json({ samples: imported, applied: false });
  }

  const design = parseDesignDocument(
    project.designJson,
    project.designLevel as DesignLevel,
    user.unitSystem,
  );
  const gradeSamples = mergeGradeWalkSamples({
    existing: design.gradeSamples ?? [],
    imported,
    replaceExisting: body.replaceExisting !== false,
  });
  const next = normalizeDesignDocument(
    { ...design, gradeSamples } as typeof design,
    {
      designLevel: project.designLevel as DesignLevel,
      unitSystem: user.unitSystem,
    },
  );

  const updated = await prisma.project.update({
    where: { id: project.id },
    data: {
      designJson: JSON.stringify(next),
      designRevision: { increment: 1 },
    },
  });

  return NextResponse.json({
    samples: imported as GradeSample[],
    applied: true,
    designRevision: updated.designRevision,
    gradeSampleCount: (next.gradeSamples ?? []).length,
  });
}
