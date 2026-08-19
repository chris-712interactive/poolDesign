"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  clientCanApprove,
  parseDesignStatus,
  type DesignStatus,
} from "@pool-design/shared";

type ReviewInfo = {
  designStatus: DesignStatus;
  requestClientApproval: boolean;
  canApprove: boolean;
  canRequestChanges: boolean;
};

type Props = {
  token: string;
};

type Mode = "idle" | "changes" | "approve";

function pickRecorderMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/mpeg",
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

function VoiceNoteRecorder({
  disabled,
  onBlob,
}: {
  disabled: boolean;
  onBlob: (blob: Blob | null) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      recorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (playbackUrl) URL.revokeObjectURL(playbackUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function start() {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Voice notes aren’t supported in this browser. Type a note instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mime = pickRecorderMime();
      const recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const type = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        if (playbackUrl) URL.revokeObjectURL(playbackUrl);
        if (blob.size < 32) {
          setPlaybackUrl(null);
          onBlob(null);
          return;
        }
        setPlaybackUrl(URL.createObjectURL(blob));
        onBlob(blob);
      };
      recorder.start();
      setRecording(true);
    } catch {
      setError("Couldn’t start the microphone. Type a note instead, or allow mic access.");
    }
  }

  function stop() {
    setRecording(false);
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
  }

  function clear() {
    if (playbackUrl) URL.revokeObjectURL(playbackUrl);
    setPlaybackUrl(null);
    onBlob(null);
  }

  return (
    <div className="client-review-voice">
      {recording ? (
        <button
          type="button"
          className="btn secondary"
          disabled={disabled}
          onClick={stop}
        >
          Stop recording
        </button>
      ) : (
        <button
          type="button"
          className="btn secondary"
          disabled={disabled}
          onClick={() => void start()}
        >
          {playbackUrl ? "Re-record voice note" : "Record a voice note"}
        </button>
      )}
      {playbackUrl ? (
        <div className="client-review-playback">
          <audio controls src={playbackUrl} />
          <button type="button" className="btn ghost" disabled={disabled} onClick={clear}>
            Remove
          </button>
        </div>
      ) : null}
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}

export function ClientReviewPanel({ token }: Props) {
  const [info, setInfo] = useState<ReviewInfo | null>(null);
  const [mode, setMode] = useState<Mode>("idle");
  const [note, setNote] = useState("");
  const [voice, setVoice] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"approved" | "changes_requested" | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/p/${token}/review`, { cache: "no-store" });
    if (!res.ok) return;
    const json = (await res.json()) as {
      designStatus?: unknown;
      requestClientApproval?: boolean;
      canApprove?: boolean;
      canRequestChanges?: boolean;
    };
    const designStatus = parseDesignStatus(json.designStatus);
    const requestClientApproval = Boolean(json.requestClientApproval);
    setInfo({
      designStatus,
      requestClientApproval,
      canApprove:
        typeof json.canApprove === "boolean"
          ? json.canApprove
          : clientCanApprove({ designStatus, requestClientApproval }),
      canRequestChanges: json.canRequestChanges !== false,
    });
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function submit(kind: "approved" | "changes_requested") {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("kind", kind);
      form.set("noteText", note);
      if (voice) {
        const ext = voice.type.includes("mp4") ? "m4a" : "webm";
        form.set("voice", voice, `note.${ext}`);
      }
      const res = await fetch(`/api/p/${token}/review`, {
        method: "POST",
        body: form,
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Could not send your reply");
      setDone(kind);
      setMode("idle");
      setNote("");
      setVoice(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send your reply");
    } finally {
      setBusy(false);
    }
  }

  const canApprove = Boolean(info?.canApprove) && done !== "approved";
  const showComposer = mode !== "idle" && !done;

  return (
    <section className="proposal-panel client-review-panel">
      <h2>Your response</h2>
      {done === "approved" ? (
        <p className="muted" style={{ margin: 0 }}>
          Thank you — this design is marked approved. Your designer has the
          timestamp on the job.
        </p>
      ) : done === "changes_requested" ? (
        <p className="muted" style={{ margin: 0 }}>
          Got it. Your notes are on the job with the time you sent them.
        </p>
      ) : (
        <p className="muted" style={{ margin: "0 0 0.75rem" }}>
          Ask for edits anytime. Approve is only available when your designer
          sends this revision for sign-off.
        </p>
      )}

      {!done ? (
        <div className="client-review-actions">
          <button
            type="button"
            className={mode === "changes" ? "btn" : "btn secondary"}
            disabled={busy}
            onClick={() => setMode("changes")}
          >
            Request changes
          </button>
          {canApprove ? (
            <button
              type="button"
              className={mode === "approve" ? "btn" : "btn secondary"}
              disabled={busy}
              onClick={() => setMode("approve")}
            >
              Approve design
            </button>
          ) : null}
        </div>
      ) : null}

      {showComposer ? (
        <div className="client-review-compose">
          <label htmlFor="client-review-note">
            {mode === "changes"
              ? "What should we update?"
              : "Optional note with your approval"}
          </label>
          <textarea
            id="client-review-note"
            rows={4}
            value={note}
            disabled={busy}
            placeholder={
              mode === "changes"
                ? "e.g. Move the spa closer to the house, keep the tanning ledge."
                : "Anything you’d like us to remember."
            }
            onChange={(e) => setNote(e.target.value)}
          />
          <VoiceNoteRecorder disabled={busy} onBlob={setVoice} />
          <div className="client-review-actions">
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() =>
                void submit(mode === "approve" ? "approved" : "changes_requested")
              }
            >
              {busy
                ? "Sending…"
                : mode === "approve"
                  ? "Send approval"
                  : "Send change request"}
            </button>
            <button
              type="button"
              className="btn secondary"
              disabled={busy}
              onClick={() => {
                setMode("idle");
                setError(null);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}
