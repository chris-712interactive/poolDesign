export type CameraPose3D = {
  position: [number, number, number];
  target: [number, number, number];
};

function storageKey(projectId: string): string {
  return `poolDesign.cam3d.${projectId}`;
}

export function loadCameraPose(projectId: string): CameraPose3D | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CameraPose3D;
    if (
      !Array.isArray(parsed.position) ||
      !Array.isArray(parsed.target) ||
      parsed.position.length !== 3 ||
      parsed.target.length !== 3
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveCameraPose(projectId: string, pose: CameraPose3D): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(projectId), JSON.stringify(pose));
  } catch {
    // ignore quota / private mode
  }
}
