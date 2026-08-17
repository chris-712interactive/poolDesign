import {
  createSurveyUnderlay,
  type DesignDocument,
} from "@pool-design/shared";

export async function importSurveyUnderlayFromFile(
  projectId: string,
  file: File,
  design: DesignDocument,
): Promise<DesignDocument> {
  const dims = await readSurveyImageSize(file);
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`/api/projects/${projectId}/survey-underlay`, {
    method: "POST",
    body: fd,
  });
  const json = (await res.json()) as { url?: string; error?: string };
  if (!res.ok || !json.url) throw new Error(json.error || "Upload failed");
  return {
    ...design,
    surveyUnderlay: createSurveyUnderlay({
      imageUrl: json.url,
      pixelWidth: dims.width,
      pixelHeight: dims.height,
    }),
    layers: design.layers.some((l) => l.id === "survey")
      ? design.layers.map((l) =>
          l.id === "survey" ? { ...l, visible: true } : l,
        )
      : [...design.layers, { id: "survey", name: "survey", visible: true }],
  };
}

export function readSurveyImageSize(
  file: File,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      URL.revokeObjectURL(url);
      if (width < 8 || height < 8) reject(new Error("Image is too small"));
      else resolve({ width, height });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image"));
    };
    img.src = url;
  });
}
