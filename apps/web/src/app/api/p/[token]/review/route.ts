import { NextResponse } from "next/server";
import { prisma } from "@pool-design/db";
import {
  applyClientReview,
  clientCanApprove,
  MAX_REVIEW_NOTE_CHARS,
  parseDesignStatus,
  parseReviewKind,
  reviewNoteOk,
  storedVoiceUrl,
} from "@pool-design/shared";

type RouteContext = { params: Promise<{ token: string }> };

const MAX_VOICE_BYTES = 8_000_000;
const VOICE_TYPES = new Set([
  "audio/webm",
  "audio/webm;codecs=opus",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "audio/x-m4a",
  "audio/aac",
]);

function localPostgres(): boolean {
  const url = process.env.DATABASE_URL ?? "";
  return url.includes("localhost") || url.includes("127.0.0.1");
}

function voiceTypeOk(type: string): boolean {
  const t = type.toLowerCase();
  if (VOICE_TYPES.has(t)) return true;
  return t.startsWith("audio/webm") || t.startsWith("audio/mp4");
}

async function loadShare(token: string) {
  const share = await prisma.projectShare.findUnique({
    where: { token },
    select: {
      id: true,
      revokedAt: true,
      expiresAt: true,
      project: {
        select: {
          id: true,
          designStatus: true,
          requestClientApproval: true,
        },
      },
    },
  });
  if (!share || share.revokedAt) return null;
  if (share.expiresAt && share.expiresAt.getTime() < Date.now()) return null;
  return share;
}

async function putVoice(
  projectId: string,
  file: File,
): Promise<{ url: string } | { error: string; status: number }> {
  if (file.size < 32) {
    return { error: "Voice note is empty.", status: 400 };
  }
  if (file.size > MAX_VOICE_BYTES) {
    return { error: "Voice note is too large (max 8 MB).", status: 413 };
  }
  const type = (file.type || "audio/webm").toLowerCase();
  if (!voiceTypeOk(type)) {
    return { error: "Use a recorded audio note (webm or mp4).", status: 400 };
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = type.includes("mp4") || type.includes("m4a") || type.includes("aac")
    ? "m4a"
    : type.includes("mpeg")
      ? "mp3"
      : type.includes("ogg")
        ? "ogg"
        : type.includes("wav")
          ? "wav"
          : "webm";
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (token) {
    try {
      const { put } = await import("@vercel/blob");
      const blob = await put(
        `reviews/${projectId}/${Date.now()}.${ext}`,
        buffer,
        {
          access: "public",
          contentType: type.split(";")[0],
          token,
        },
      );
      return { url: blob.url };
    } catch (err) {
      console.error("review voice blob upload failed", err);
      return { error: "Could not store the voice note.", status: 500 };
    }
  }
  if (localPostgres()) {
    return {
      url: `data:${type.split(";")[0]};base64,${buffer.toString("base64")}`,
    };
  }
  return {
    error:
      "Voice notes need file storage (BLOB_READ_WRITE_TOKEN). Leave a text note instead.",
    status: 503,
  };
}

async function readReviewBody(request: Request): Promise<{
  kind: unknown;
  noteText: string;
  voice: File | null;
}> {
  const ctype = request.headers.get("content-type") ?? "";
  if (ctype.includes("multipart/form-data")) {
    const form = await request.formData().catch(() => null);
    const kind = form?.get("kind");
    const note = form?.get("noteText");
    const voice = form?.get("voice");
    return {
      kind: typeof kind === "string" ? kind : null,
      noteText: typeof note === "string" ? note : "",
      voice: voice instanceof File ? voice : null,
    };
  }
  const json = (await request.json().catch(() => ({}))) as {
    kind?: unknown;
    noteText?: unknown;
  };
  return {
    kind: json.kind,
    noteText: typeof json.noteText === "string" ? json.noteText : "",
    voice: null,
  };
}

function serializeShare(share: {
  project: { designStatus: string; requestClientApproval: boolean };
}) {
  const designStatus = parseDesignStatus(share.project.designStatus);
  const requestClientApproval = share.project.requestClientApproval;
  return {
    designStatus,
    requestClientApproval,
    canApprove: clientCanApprove({ designStatus, requestClientApproval }),
    canRequestChanges: true,
  };
}

/** Public: whether this share may approve / request changes. */
export async function GET(_request: Request, context: RouteContext) {
  const { token } = await context.params;
  const share = await loadShare(token);
  if (!share) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(serializeShare(share), {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

/** Public: client approve or request changes (text and/or voice). */
export async function POST(request: Request, context: RouteContext) {
  const { token } = await context.params;
  const share = await loadShare(token);
  if (!share) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await readReviewBody(request);
  const kind = parseReviewKind(body.kind);
  if (!kind) {
    return NextResponse.json(
      { error: "Choose Approve or Request changes." },
      { status: 400 },
    );
  }

  const noteText = body.noteText.trim().slice(0, MAX_REVIEW_NOTE_CHARS);
  const hasVoice = Boolean(body.voice && body.voice.size > 0);
  if (!reviewNoteOk(kind, noteText, hasVoice)) {
    return NextResponse.json(
      { error: "Leave a text note or a voice note so we know what to change." },
      { status: 400 },
    );
  }

  const designStatus = parseDesignStatus(share.project.designStatus);
  if (
    kind === "approved" &&
    !clientCanApprove({
      designStatus,
      requestClientApproval: share.project.requestClientApproval,
    })
  ) {
    return NextResponse.json(
      {
        error:
          "This revision is not open for approval. Ask your designer if you need to sign off.",
      },
      { status: 409 },
    );
  }

  let voiceUrl: string | null = null;
  if (body.voice && body.voice.size > 0) {
    const stored = await putVoice(share.project.id, body.voice);
    if ("error" in stored) {
      return NextResponse.json(
        { error: stored.error },
        { status: stored.status },
      );
    }
    voiceUrl = storedVoiceUrl(stored.url);
  }

  const next = applyClientReview(kind);
  const [review] = await prisma.$transaction([
    prisma.projectReview.create({
      data: {
        projectId: share.project.id,
        shareId: share.id,
        kind,
        noteText: noteText || null,
        voiceUrl,
      },
    }),
    prisma.project.update({
      where: { id: share.project.id },
      data: {
        designStatus: next.designStatus,
        requestClientApproval: next.requestClientApproval,
      },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    review: {
      id: review.id,
      kind: review.kind,
      noteText: review.noteText,
      voiceUrl: storedVoiceUrl(review.voiceUrl),
      createdAt: review.createdAt.toISOString(),
    },
    ...serializeShare({
      project: {
        designStatus: next.designStatus,
        requestClientApproval: next.requestClientApproval,
      },
    }),
  });
}
