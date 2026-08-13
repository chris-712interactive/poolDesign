"use client";

import dynamic from "next/dynamic";
import type { MutableRefObject } from "react";
import type { DesignDocument } from "@pool-design/shared";
import type { SceneSelection } from "@/lib/cad3d/buildScene";
import type { CadScene3DHandle } from "@/lib/cad3d/cadScene3dHandle";

const CadScene3DInner = dynamic(
  () =>
    import("@/components/CadScene3DCanvas").then((m) => m.CadScene3DCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="cad-scene3d cad-scene3d-loading muted">
        Loading 3D preview…
      </div>
    ),
  },
);

type Props = {
  design: DesignDocument;
  projectId: string;
  projectName: string;
  selection: SceneSelection | null;
  onSelect: (sel: SceneSelection | null) => void;
  onDelete?: () => void;
  exportHandleRef?: MutableRefObject<CadScene3DHandle | null>;
};

export function CadScene3DDynamic(props: Props) {
  return <CadScene3DInner {...props} />;
}
