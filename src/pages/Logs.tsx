import { useState } from "react";
import { Button, HTMLSelect, Tag } from "@blueprintjs/core";
import { DEPLOYABLES } from "@/mock/world";
import type { Stage } from "@/lib/types";
import { STAGES, cellKey } from "@/lib/types";
import type { MatrixResponse } from "@/lib/types";

/** Standalone entry point for R3 — pick a service+stage, open the drawer. */
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
      <div
        className="flex shrink-0 items-center gap-3 border-b px-4 py-2.5"
        style={{ borderColor: "var(--tower-edge)", background: "var(--tower-panel)" }}
      >
        <div>
          <div className="text-[14px] font-bold leading-none text-white">Logs</div>
          <div className="mt-1 text-[11px]" style={{ color: "var(--tower-dimmer)" }}>
            Last 10 minutes across every Lambda in a service's stack. Tower stores nothing.
          </div>
        </div>
        <div className="flex-1" />
        <HTMLSelect
          minimal
          value={stage}
          onChange={(e) => setStage(e.currentTarget.value as Stage)}
          options={STAGES.map((s) => ({ label: s, value: s }))}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-3">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(268px,1fr))] gap-2">
          {DEPLOYABLES.map((d) => {
            const cell = matrix?.cells[cellKey(d.name, stage)];
            const absent = !cell || cell.status === "absent";
            return (
              <button
                key={d.name}
                disabled={absent}
                onClick={() => onLogs(d.name, stage)}
                className="flex items-center gap-2 rounded-[2px] border px-2.5 py-2 text-left disabled:opacity-40"
                style={{
                  borderColor: "var(--tower-edge)",
                  background: "var(--tower-panel)",
                  cursor: absent ? "not-allowed" : "pointer",
                }}
              >
                <div className="min-w-0 flex-1">
                  <div className="mono truncate text-[12.5px] text-white">{d.name}</div>
                  <div className="mono text-[10.5px]" style={{ color: "var(--tower-dimmer)" }}>
                    {d.functions.length} log groups
                  </div>
                </div>
                {absent ? <Tag minimal>no stack</Tag> : <Button small minimal icon="console" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
