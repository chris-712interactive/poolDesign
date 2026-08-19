"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DESIGN_LEVEL_LABELS, DESIGN_STATUS_LABELS, type DesignLevel, type DesignStatus } from "@pool-design/shared";

type ProjectRow = {
  id: string;
  name: string;
  clientName: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  designLevel: DesignLevel;
  designStatus?: DesignStatus;
};

export function ProjectList({ projects }: { projects: ProjectRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function remove(project: ProjectRow) {
    const ok = window.confirm(
      `Delete “${project.name}”? This cannot be undone.`,
    );
    if (!ok) return;
    setError(null);
    setBusyId(project.id);
    try {
      const res = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Could not delete project");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete project");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="stack" style={{ marginTop: "1rem" }}>
      {error ? <p className="error">{error}</p> : null}
      {projects.map((project) => (
        <div key={project.id} className="card-link project-row">
          <Link href={`/app/projects/${project.id}`} className="project-row-main">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <strong>{project.name}</strong>
              <span className="row" style={{ gap: "0.35rem" }}>
                {project.designStatus && project.designStatus !== "in_design" ? (
                  <span
                    className={`badge ${
                      project.designStatus === "approved"
                        ? "ok"
                        : project.designStatus === "changes_requested"
                          ? "warn"
                          : ""
                    }`}
                  >
                    {DESIGN_STATUS_LABELS[project.designStatus]}
                  </span>
                ) : null}
                <span className="badge">
                  {DESIGN_LEVEL_LABELS[project.designLevel]}
                </span>
              </span>
            </div>
            <div className="muted">
              {[
                project.clientName,
                project.phone,
                project.address ||
                  (project.city || project.state
                    ? [project.city, project.state].filter(Boolean).join(", ")
                    : null),
              ]
                .filter(Boolean)
                .join(" · ") || "No contact or job site yet"}
            </div>
          </Link>
          <div className="project-row-actions">
            <Link
              href={`/app/projects/${project.id}/details`}
              className="btn secondary"
            >
              Details
            </Link>
            <button
              type="button"
              className="btn danger"
              disabled={busyId === project.id}
              onClick={() => void remove(project)}
            >
              {busyId === project.id ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
