import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Callout } from "@/components/ui/callout";
import { CenteredSpinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, StatTiles } from "@/components/PageHeader";
import { Cell } from "@/pages/Matrix";
import type { MatrixResponse, Stage } from "@/lib/types";
import { cellKey } from "@/lib/types";
import { cn } from "@/lib/utils";

const BLURB: Record<Stage, string> = {
  dev: "Deployed on every push to the dev branch. Safe to roll back freely.",
  staging:
    "Defined but not wired to any pipeline. Most services have never been deployed here — R4.3 makes this a real stage.",
  prod: "Deployed on every push to master, and again when a GitHub Release is published. Two paths in, which is one too many.",
};

/** Single-environment view: every service on one stage, Apollo-style. */
export function EnvironmentPage({
  matrix,
  loading,
  onLogs,
  onRollback,
}: {
  matrix: MatrixResponse | null;
  loading: boolean;
  onLogs: (s: string, st: Stage) => void;
  onRollback: (s: string, st: Stage) => void;
}) {
  const { stage: stageParam } = useParams<{ stage: string }>();
  const stage = (stageParam ?? "prod") as Stage;
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    if (!matrix) return [];
    const needle = q.trim().toLowerCase();
    return matrix.deployables.filter((d) => (d.name + d.path).toLowerCase().includes(needle));
  }, [matrix, q]);

  const counts = useMemo(() => {
    const c = { current: 0, behind: 0, failed: 0, absent: 0 };
    if (matrix)
      for (const d of matrix.deployables) {
        const cell = matrix.cells[cellKey(d.name, stage)];
        if (!cell || cell.status === "absent") c.absent++;
        else if (cell.status === "failed") c.failed++;
        else if (cell.status === "behind") c.behind++;
        else c.current++;
      }
    return c;
  }, [matrix, stage]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title={
          <>
            <span className="mono">{stage}</span>
            {stage === "prod" && <Badge tone="red">live</Badge>}
            {stage === "staging" && <Badge tone="gray">no pipeline</Badge>}
          </>
        }
        description={BLURB[stage]}
        meta={
          <StatTiles
            items={[
              { value: counts.current, label: "current", tone: counts.current ? "text-status-green-fg" : undefined },
              { value: counts.behind, label: "behind", tone: counts.behind ? "text-status-amber-fg" : undefined },
              { value: counts.failed, label: "failed", tone: counts.failed ? "text-status-red-fg" : undefined },
              { value: counts.absent, label: "never deployed" },
            ]}
          />
        }
      />

      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-card px-5 py-2">
        <div className="relative w-[240px]">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-[26px] pl-7 text-[11.5px]"
            placeholder="Filter services"
            value={q}
            onChange={(e) => setQ(e.currentTarget.value)}
          />
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-1.5">
          {(["dev", "staging", "prod"] as Stage[]).map((s) => (
            <Link
              key={s}
              to={`/environment/${s}`}
              className={cn(
                "mono rounded border px-2 py-[3px] text-[11.5px] no-underline transition-colors",
                s === stage
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-white text-muted-foreground hover:bg-secondary",
              )}
            >
              {s}
            </Link>
          ))}
        </div>
      </div>

      {matrix?.stale && (
        <div className="shrink-0 px-5 pt-3">
          <Callout tone="warning" title="Showing last-known state">
            AWS is unreachable. Rollback is disabled.
          </Callout>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto p-5 pt-3">
        <div className="overflow-hidden rounded border border-border bg-card">
          {!matrix && loading ? (
            <CenteredSpinner label="Reading CloudFormation…" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead style={{ width: 260 }}>Service</TableHead>
                  <TableHead style={{ width: 210 }}>Stack</TableHead>
                  <TableHead>Deployed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((d) => {
                  const cell = matrix!.cells[cellKey(d.name, stage)];
                  return (
                    <TableRow key={d.name}>
                      <TableCell>
                        <Link
                          to={`/service/${encodeURIComponent(d.name)}/${stage}`}
                          className="mono block truncate text-[12.5px] font-medium text-primary no-underline hover:underline"
                        >
                          {d.name}
                        </Link>
                        <div className="mono mt-[2px] truncate text-[10.5px] text-muted-foreground">
                          {d.path} · {d.functions.length} fn
                        </div>
                      </TableCell>
                      <TableCell className="mono truncate pt-2 text-[11.5px] text-muted-foreground">
                        {d.stackPattern.replace("{stage}", stage)}
                      </TableCell>
                      <TableCell className="!px-1.5 !py-1">
                        <Cell
                          cell={cell}
                          service={d.name}
                          stage={stage}
                          disabled={Boolean(matrix?.stale)}
                          onLogs={onLogs}
                          onRollback={onRollback}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}
