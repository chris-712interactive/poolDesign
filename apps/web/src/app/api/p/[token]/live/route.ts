import { NextResponse } from "next/server";
import { prisma } from "@pool-design/db";
import { scrubDataUrlStills } from "@/lib/scrub-data-url-stills";
import {
  emptyLiveSessionState,
  parseLiveSessionState,
  storedPreviewUrl,
  type LiveSessionApproval,
  type LiveSessionFinishes,
  type LiveSessionState,
} from "@pool-design/shared";

const liveShareSelect = {
  id: true,
  revokedAt: true,
  expiresAt: true,
  updatedAt: true,
  previewImageUrl: true,
  project: {
    select: {
      name: true,
      liveSession: {
        select: {
          id: true,
          active: true,
          stateJson: true,
          updatedAt: true,
        },
      },
      company: { select: { name: true } },
    },
  },
} as const;

async function loadShareSession(token: string) {
  const share = await prisma.projectShare.findUnique({
    where: { token },
    select: liveShareSelect,
  });
  if (!share || share.revokedAt) return null;
  if (share.expiresAt && share.expiresAt.getTime() < Date.now()) return null;
  return share;
}

function serialize(
  session: {
    id: string;
    active: boolean;
    stateJson: string;
    updatedAt: Date;
  } | null,
  companyName: string,
  projectName: string,
  sharePreviewImageUrl: string | null,
  shareUpdatedAt?: Date | null,
) {
  const state = session
    ? parseLiveSessionState(JSON.parse(session.stateJson || "{}"))
    : emptyLiveSessionState();
  if (session) state.active = session.active;
  const livePreview = storedPreviewUrl(state.previewImageUrl);
  const sharePreview = storedPreviewUrl(sharePreviewImageUrl);
  const previewImageUrl = session?.active
    ? livePreview || sharePreview
    : sharePreview || livePreview;
  state.previewImageUrl = previewImageUrl;
  const stamp = session?.updatedAt ?? shareUpdatedAt ?? null;
  return {
    companyName,
    projectName,
    active: Boolean(session?.active),
    updatedAt: stamp ? stamp.toISOString() : null,
    hasPreview: Boolean(previewImageUrl),
    previewImageUrl,
    state,
  };
}

/** Guest poll for live kitchen-table session. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  await scrubDataUrlStills();
  const share = await loadShareSession(token);
  if (!share) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(
    serialize(
      share.project.liveSession,
      share.project.company.name,
      share.project.name,
      storedPreviewUrl(share.previewImageUrl),
      share.updatedAt,
    ),
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}

/** Guest finish swap / approval / heartbeat. */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const share = await loadShareSession(token);
  if (!share) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let session = share.project.liveSession;
  if (!session || !session.active) {
    return NextResponse.json(
      { error: "No live session is active. Ask your designer to start one." },
      { status: 409 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    finishes?: LiveSessionFinishes;
    approval?: { label: string; status: "approved" | "rejected" };
    heartbeat?: boolean;
  };

  const state: LiveSessionState = parseLiveSessionState(
    JSON.parse(session.stateJson || "{}"),
  );
  state.active = true;
  state.guestOnlineAt = new Date().toISOString();

  if (body.finishes) {
    state.finishes = {
      ...state.finishes,
      ...body.finishes,
      patioMaterialById: {
        ...(state.finishes.patioMaterialById ?? {}),
        ...(body.finishes.patioMaterialById ?? {}),
      },
    };
    state.appliedFinishesKey = null;
  }
  if (body.approval) {
    const entry: LiveSessionApproval = {
      id: `ap_${Date.now().toString(36)}`,
      label: body.approval.label,
      status: body.approval.status,
      at: new Date().toISOString(),
      by: "guest",
    };
    state.approvals = [...state.approvals, entry];
  }

  session = await prisma.projectLiveSession.update({
    where: { id: session.id },
    data: { stateJson: JSON.stringify(state) },
    select: {
      id: true,
      active: true,
      stateJson: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(
    serialize(
      session,
      share.project.company.name,
      share.project.name,
      storedPreviewUrl(share.previewImageUrl),
      share.updatedAt,
    ),
  );
}
