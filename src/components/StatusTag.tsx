import { Spinner, Tag, type Intent } from "@blueprintjs/core";
import type { CellStatus } from "@/lib/types";

const MAP: Record<CellStatus, { label: string; intent: Intent; minimal?: boolean }> = {
  current: { label: "current", intent: "success" },
  behind: { label: "behind", intent: "warning" },
  failed: { label: "failed", intent: "danger" },
  "rolling-back": { label: "rolling back", intent: "primary" },
  unknown: { label: "unknown", intent: "none" },
  absent: { label: "no deploys", intent: "none", minimal: true },
};

export function StatusTag({
  status,
  behindBy,
  behindOf,
}: {
  status: CellStatus;
  behindBy?: number;
  behindOf?: string;
}) {
  const cfg = MAP[status];
  const label =
    status === "behind" && behindBy
      ? `${behindBy} behind ${behindOf ?? ""}`.trim()
      : cfg.label;

  return (
    <Tag
      intent={cfg.intent}
      minimal={cfg.minimal ?? status !== "current"}
      icon={status === "rolling-back" ? <Spinner size={10} /> : undefined}
    >
      {label}
    </Tag>
  );
}
