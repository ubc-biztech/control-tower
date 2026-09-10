import { useState } from "react";
import { Terminal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/PageHeader";
import { DEPLOYABLES } from "@/mock/world";
import type { MatrixResponse, Stage } from "@/lib/types";
import { STAGES, cellKey } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Entry point for R3 — pick a service and stage, open the drawer. */
export function LogsPage({
  matrix,
  onLogs,
}: {
  matrix: MatrixResponse | null;
  onLogs: (s: string, st: Stage) => void;
}) {
  const [stage, setStage] = useState<Stage>("prod");

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title="Logs"
        description="The last 10 minutes across every Lambda in a service's stack, merged and sorted. Log groups are discovered from the stack's resources, so new functions appear on their own. Tower stores nothing."
        actions={
          <div className="flex items-center gap-1">
            {STAGES.map((s) => (
              <button
                key={s}
                onClick={() => setStage(s)}
                className={cn(
                  "mono rounded border px-2 py-[3px] text-[11.5px] transition-colors",
                  s === stage
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-white text-muted-foreground hover:bg-secondary",
                )}
              >
                {s}
              </button>
            ))}
          </div>
        }
      />

      <div className="min-h-0 flex-1 overflow-auto p-5">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(272px,1fr))] gap-2">
          {DEPLOYABLES.map((d) => {
            const cell = matrix?.cells[cellKey(d.name, stage)];
            const absent = !cell || cell.status === "absent";
            return (
              <button
                key={d.name}
                disabled={absent}
                onClick={() => onLogs(d.name, stage)}
                className={cn(
                  "flex items-center gap-2.5 rounded border border-border bg-card px-3 py-2.5 text-left transition-colors",
                  absent ? "cursor-not-allowed opacity-55" : "hover:border-primary/50 hover:bg-[#F2F6FB]",
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="mono truncate text-[12.5px] font-medium">{d.name}</div>
                  <div className="mono text-[10.5px] text-muted-foreground">
                    {d.functions.length} log groups
                  </div>
                </div>
                {absent ? (
                  <Badge tone="gray">no stack</Badge>
                ) : (
                  <Terminal className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
