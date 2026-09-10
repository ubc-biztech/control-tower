import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Boxes, CircleCheck, HelpCircle, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Callout } from "@/components/ui/callout";
import { CenteredSpinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/PageHeader";
import { StatTiles } from "@/components/StatTiles";
import { DeploymentCell } from "@/components/DeploymentCell";
import type { MatrixResponse, Stage } from "@/lib/types";
import { STAGES, cellKey } from "@/lib/types";
import { cn } from "@/lib/utils";

export function EnvironmentsPage({
  data,
  loading,
  error,
  onLogs,
  onRollback,
}: {
  data: MatrixResponse | null;
  loading: boolean;
  error: string | null;
  onLogs: (service: string, stage: Stage) => void;
  onRollback: (service: string, stage: Stage) => void;
}) {
  const [q, setQ] = useState("");
  const [only, setOnly] = useState<"all" | "attention">("all");

  const rows = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    return data.deployables.filter((d) => {
      if (needle && !(d.name + d.path).toLowerCase().includes(needle)) return false;
      if (only === "attention") {
        return STAGES.some((s) => {
          const c = data.cells[cellKey(d.name, s)];
          return c && (c.status === "failed" || c.status === "behind" || c.status === "unknown");
        });
      }
      return true;
    });
  }, [data, q, only]);

  const counts = useMemo(() => {
    const c = { failed: 0, behind: 0, unknown: 0, absent: 0, current: 0 };
    if (data)
      for (const cell of Object.values(data.cells)) {
        if (cell.status === "current" || cell.status === "rolling-back") c.current++;
        else if (cell.status === "failed") c.failed++;
        else if (cell.status === "behind") c.behind++;
        else if (cell.status === "unknown") c.unknown++;
        else c.absent++;
      }
    return c;
  }, [data]);

  if (error && !data) {
    return (
      <div className="p-5">
        <Callout tone="danger" title="Cannot reach AWS">
          {error} — Control Tower has no cached state to fall back on yet.
        </Callout>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title="Environments"
        description="What is deployed where, read from CloudFormation stack tags and each stack's deployment bucket. AWS is the source of truth; when Control Tower and AWS disagree, AWS wins."
        meta={
          <StatTiles
            items={[
              { value: data?.deployables.length ?? "—", label: "services", icon: <Boxes className="h-4 w-4" /> },
              { value: counts.current, label: "current", tone: counts.current ? "text-status-green-fg" : undefined, icon: <CircleCheck className="h-4 w-4 text-status-green-fg" /> },
              { value: counts.behind, label: "behind", tone: counts.behind ? "text-status-amber-fg" : undefined, icon: <AlertTriangle className="h-4 w-4 text-status-amber-fg" /> },
              { value: counts.failed, label: "failed", tone: counts.failed ? "text-status-red-fg" : undefined, icon: <AlertTriangle className="h-4 w-4 text-status-red-fg" /> },
              { value: counts.absent, label: "never deployed", icon: <HelpCircle className="h-4 w-4" /> },
            ]}
          />
        }
      />

      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-card px-5 py-2">
        <div className="flex overflow-hidden rounded border border-border">
          <button
            onClick={() => setOnly("all")}
            className={cn(
              "px-2.5 py-1 text-[11.5px] font-medium transition-colors",
              only === "all" ? "bg-primary text-primary-foreground" : "bg-white hover:bg-secondary",
            )}
          >
            All services
          </button>
          <button
            onClick={() => setOnly("attention")}
            className={cn(
              "border-l border-border px-2.5 py-1 text-[11.5px] font-medium transition-colors",
              only === "attention" ? "bg-primary text-primary-foreground" : "bg-white hover:bg-secondary",
            )}
          >
            Needs attention
          </button>
        </div>

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
        <span className="text-[11.5px] text-muted-foreground">
          {rows.length} of {data?.deployables.length ?? 0} shown
        </span>
      </div>

      {data?.stale && (
        <div className="shrink-0 px-5 pt-3">
          <Callout tone="warning" title="Showing last-known state">
            AWS is unreachable. Nothing here is confirmed live, and rollback is disabled until Control
            Tower can read CloudFormation again.
          </Callout>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto p-5 pt-3">
        <div className="overflow-hidden rounded border border-border bg-card">
          {!data && loading ? (
            <CenteredSpinner label="Reading CloudFormation…" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead style={{ width: 244 }}>Service</TableHead>
                  {STAGES.map((s) => (
                    <TableHead key={s}>
                      <span className="flex items-center gap-1.5">
                        {s}
                        {s === "prod" && <Badge tone="red">live</Badge>}
                        {s === "staging" && <Badge tone="gray">no pipeline</Badge>}
                      </span>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((d) => (
                  <TableRow key={d.name}>
                    <TableCell>
                      <Link
                        to={`/service/${encodeURIComponent(d.name)}/prod`}
                        className="mono block truncate text-[12.5px] font-medium text-primary no-underline hover:underline"
                      >
                        {d.name}
                      </Link>
                      <div className="mono mt-[2px] truncate text-[10.5px] text-muted-foreground">
                        {d.path} · {d.functions.length} fn
                      </div>
                    </TableCell>
                    {STAGES.map((stage) => (
                      <TableCell key={stage} className="!px-1.5 !py-1">
                        <DeploymentCell
                          cell={data!.cells[cellKey(d.name, stage)]}
                          service={d.name}
                          stage={stage}
                          disabled={Boolean(data?.stale)}
                          onLogs={onLogs}
                          onRollback={onRollback}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={4} className="!py-12 text-center text-muted-foreground">
                      No services match.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}
