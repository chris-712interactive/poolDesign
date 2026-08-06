import type { ReactNode } from "react";

type ToolId =
  | "select"
  | "pool_rect"
  | "pool_poly"
  | "steps"
  | "bench"
  | "patio"
  | "plumbing"
  | "place"
  | "measure";

const iconProps = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function Svg({ children }: { children: ReactNode }) {
  return <svg {...iconProps}>{children}</svg>;
}

export const TOOL_META: {
  id: ToolId;
  label: string;
  icon: ReactNode;
}[] = [
  {
    id: "select",
    label: "Select / edit",
    icon: (
      <Svg>
        <path d="M4 4l7 16 2-7 7-2z" />
      </Svg>
    ),
  },
  {
    id: "pool_rect",
    label: "Pool rectangle",
    icon: (
      <Svg>
        <rect x="4" y="7" width="16" height="10" rx="1.5" />
        <path d="M8 10h8M8 14h5" />
      </Svg>
    ),
  },
  {
    id: "pool_poly",
    label: "Pool polygon",
    icon: (
      <Svg>
        <path d="M5 16L9 6l6 3 4 8z" />
      </Svg>
    ),
  },
  {
    id: "steps",
    label: "Steps",
    icon: (
      <Svg>
        <path d="M4 18h5v-4h5V10h6V6" />
      </Svg>
    ),
  },
  {
    id: "bench",
    label: "Bench",
    icon: (
      <Svg>
        <path d="M4 14h16M6 14v4M18 14v4M5 10h14v4H5z" />
      </Svg>
    ),
  },
  {
    id: "patio",
    label: "Patio",
    icon: (
      <Svg>
        <path d="M4 18V8l8-3 8 3v10" />
        <path d="M4 12h16" />
      </Svg>
    ),
  },
  {
    id: "plumbing",
    label: "Plumbing",
    icon: (
      <Svg>
        <path d="M5 19V9h6v4h4V5h4" />
      </Svg>
    ),
  },
  {
    id: "place",
    label: "Furniture library",
    icon: (
      <Svg>
        <path d="M5 11h14v7H5zM7 11V8a5 5 0 0 1 10 0v3" />
      </Svg>
    ),
  },
  {
    id: "measure",
    label: "Measure",
    icon: (
      <Svg>
        <path d="M4 18L18 4M8 18h.01M12 14h.01M16 10h.01" />
      </Svg>
    ),
  },
];

export const ACTION_ICONS = {
  ortho: (
    <Svg>
      <path d="M4 12h16M12 4v16" />
    </Svg>
  ),
  angle: (
    <Svg>
      <path d="M5 19V5l14 14" />
      <path d="M5 19h10" />
    </Svg>
  ),
  undo: (
    <Svg>
      <path d="M9 14L4 9l5-5" />
      <path d="M4 9h10a5 5 0 0 1 0 10h-3" />
    </Svg>
  ),
  redo: (
    <Svg>
      <path d="M15 14l5-5-5-5" />
      <path d="M20 9H10a5 5 0 0 0 0 10h3" />
    </Svg>
  ),
  reset: (
    <Svg>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </Svg>
  ),
  rotate: (
    <Svg>
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <path d="M21 3v6h-6" />
    </Svg>
  ),
};
