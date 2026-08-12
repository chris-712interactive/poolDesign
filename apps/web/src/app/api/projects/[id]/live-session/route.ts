import { NextResponse } from "next/server";
import { prisma } from "@pool-design/db";
import {
  emptyLiveSessionState,
  parseDesignDocument,
  parseLiveSessionState,
  type DesignLevel,
  type LiveSessionApproval,
  type LiveSessionFinishes,
  type LiveSessionState,
} from "@pool-design/shared";
import { getSessionUser } from "@/lib/auth";
import { requireEntitlement } from "@/lib/subscription";
import { completeMilestone, newShareToken } from "@/lib/shares";
import { appBaseUrl } from "@/lib/app-url";

async function getOrCreateSession(projectId: string) {
  const existing = await prisma.projectLiveSession.findUnique({
    where: { projectId },
  });
  if (existing) return existing;
  return prisma.projectLiveSession.create({
    data: {
      projectId,
      active: false,
      stateJson: JSON.stringify(emptyLiveSessionState()),
    },
  });
}

function serialize(session: {
  id: string;
  active: boolean;
  hostUserId: string | null;
  stateJson: string;
  updatedAt: Date;
}) {
  const state = parseLiveSessionState(JSON.parse(session.stateJson || "{}"));
  state.active = session.active;
  return {
    id: session.id,
    active: session.active,
    hostUserId: session.hostUserId,
    updatedAt: session.updatedAt.toISOString(),
    state,
  };
}

/** Ensure an active client share exists; optionally set/update its still. */
async function ensureClientShare(opts: {
  projectId: string;
  companyId: string;
  userId: string;
  previewImageUrl?: string | null;
}): Promise<{ shareId: string; url: string }> {
  const { projectId, companyId, userId, previewImageUrl } = opts;
  let latest = await prisma.projectShare.findFirst({
    where: { projectId, revokedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!latest) {
    const project = await prisma.project.findUniqueOrThrow({
      where: { id: projectId },
    });
    const design = parseDesignDocument(
      project.designJson,
      project.designLevel as DesignLevel,
      project.unitSystem,
    );
    latest = await prisma.projectShare.create({
      data: {
        projectId,
        token: newShareToken(),
        includeEstimate: false,
        designSnapshotJson: JSON.stringify(design),
        previewImageUrl: previewImageUrl || null,
        createdByUserId: userId,
      },
    });
    await completeMilestone(companyId, "first_client_share");
  } else if (previewImageUrl) {
    latest = await prisma.projectShare.update({
      where: { id: latest.id },
      data: { previewImageUrl },
    });
  }

  return {
    shareId: latest.id,
    url: `${appBaseUrl()}/p/${latest.token}`,
  };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user?.companyId || !user.company) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const gate = requireEntitlement(user.company, "liveClientSession");
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

  const session = await getOrCreateSession(project.id);
  return NextResponse.json(serialize(session));
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user?.companyId || !user.company) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const gate = requireEntitlement(user.company, "liveClientSession");
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

  const body = (await request.json().catch(() => ({}))) as {
    action?: "start" | "end" | "heartbeat";
    previewImageUrl?: string | null;
  };
  const action = body.action ?? "start";
  const session = await getOrCreateSession(project.id);
  const state = parseLiveSessionState(JSON.parse(session.stateJson || "{}"));
  const now = new Date().toISOString();
  let shareLink: { shareId: string; url: string } | null = null;

  if (action === "start") {
    state.active = true;
    state.hostOnlineAt = now;
    if (typeof body.previewImageUrl === "string" && body.previewImageUrl) {
      state.previewImageUrl = body.previewImageUrl;
    }
    shareLink = await ensureClientShare({
      projectId: project.id,
      companyId: user.companyId,
      userId: user.id,
      previewImageUrl: state.previewImageUrl,
    });
  } else if (action === "end") {
    state.active = false;
  } else {
    state.hostOnlineAt = now;
    state.active = session.active || state.active;
  }

  const updated = await prisma.projectLiveSession.update({
    where: { id: session.id },
    data: {
      active: state.active,
      hostUserId: user.id,
      stateJson: JSON.stringify(state),
    },
  });

  return NextResponse.json({
    ...serialize(updated),
    share: shareLink,
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user?.companyId || !user.company) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const gate = requireEntitlement(user.company, "liveClientSession");
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

  const body = (await request.json().catch(() => ({}))) as {
    finishes?: LiveSessionFinishes;
    showEstimate?: boolean;
    previewImageUrl?: string | null;
    approval?: Omit<LiveSessionApproval, "id" | "at" | "by"> & {
      id?: string;
    };
  };

  const session = await getOrCreateSession(project.id);
  const state: LiveSessionState = parseLiveSessionState(
    JSON.parse(session.stateJson || "{}"),
  );
  state.hostOnlineAt = new Date().toISOString();
  state.active = session.active;

  if (typeof body.showEstimate === "boolean") {
    state.showEstimate = body.showEstimate;
  }
  if (typeof body.previewImageUrl === "string" && body.previewImageUrl) {
    state.previewImageUrl = body.previewImageUrl;
    await ensureClientShare({
      projectId: project.id,
      companyId: user.companyId,
      userId: user.id,
      previewImageUrl: body.previewImageUrl,
    });
  }
  if (body.finishes) {
    state.finishes = {
      ...state.finishes,
      ...body.finishes,
      patioMaterialById: {
        ...(state.finishes.patioMaterialById ?? {}),
        ...(body.finishes.patioMaterialById ?? {}),
      },
    };
  }
  if (body.approval) {
    const entry: LiveSessionApproval = {
      id: body.approval.id ?? `ap_${Date.now().toString(36)}`,
      label: body.approval.label,
      status: body.approval.status,
      at: new Date().toISOString(),
      by: "host",
    };
    state.approvals = [...state.approvals, entry];
  }

  const updated = await prisma.projectLiveSession.update({
    where: { id: session.id },
    data: { stateJson: JSON.stringify(state), active: state.active },
  });

  return NextResponse.json(serialize(updated));
}
