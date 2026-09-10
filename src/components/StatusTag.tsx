import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { CellStatus } from "@/lib/types";

const MAP: Record<CellStatus, { label: string; tone: "green" | "amber" | "red" | "blue" | "gray" }> = {
  current: { label: "current", tone: "green" },
  behind: { label: "behind", tone: "amber" },
  failed: { label: "failed", tone: "red" },
  "rolling-back": { label: "rolling back", tone: "blue" },
  unknown: { label: "unknown", tone: "gray" },
  absent: { label: "no deploys", tone: "gray" },
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
    status === "behind" && behindBy ? `${behindBy} behind ${behindOf ?? ""}`.trim() : cfg.label;

  return (
    <Badge tone={cfg.tone}>
      {status === "rolling-back" && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
      {label}
    </Badge>
  );
}
