import { useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/PageHeader";
import { StatusTag } from "@/components/StatusTag";
import { DEPLOYABLES } from "@/mock/world";
import type { MatrixResponse, Stage } from "@/lib/types";
import { STAGES, cellKey } from "@/lib/types";

/** The inventory view: deployables are config, not code (R9.3). */
export function ServicesPage({ matrix }: { matrix: MatrixResponse | null }) {
  const [q, setQ] = useState("");
  const rows = DEPLOYABLES.filter((d) =>
    (d.name + d.path + d.repo).toLowerCase().includes(q.trim().toLowerCase()),
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title="Services"
        description={
          <>
            The deployable inventory, read from <span className="mono">deployables.json</span>.
            Adding a service — including one that has moved to its own repository — is a config
            entry, not a code change. The stack name is the join key, not the folder.
          </>
        }
      />

      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-card px-5 py-2">
        <div className="relative w-[240px]">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-[26px] pl-7 text-[11.5px]"
            placeholder="Filter"
            value={q}
            onChange={(e) => setQ(e.currentTarget.value)}
          />
        </div>
        <div className="flex-1" />
        <span className="text-[11.5px] text-muted-foreground">
          {rows.length} deployables
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-5">
        <div className="overflow-hidden rounded border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead style={{ width: 200 }}>Service</TableHead>
                <TableHead style={{ width: 96 }}>Kind</TableHead>
                <TableHead style={{ width: 280 }}>Source</TableHead>
                <TableHead style={{ width: 215 }}>Stack pattern</TableHead>
                <TableHead>Stages</TableHead>
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
                  </TableCell>
                  <TableCell>
                    <Badge tone="outline">{d.kind}</Badge>
                  </TableCell>
                  <TableCell className="mono truncate text-[11.5px] text-muted-foreground">
                    {d.repo}
                    <div className="truncate text-muted-foreground/70">{d.path}</div>
                  </TableCell>
                  <TableCell className="mono truncate text-[11.5px] text-muted-foreground">
                    {d.stackPattern}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      {STAGES.map((s: Stage) => {
                        const cell = matrix?.cells[cellKey(d.name, s)];
                        return (
                          <span key={s} className="flex items-center gap-1">
                            <span className="mono text-[11px] text-muted-foreground">{s}</span>
                            <StatusTag
                              status={cell?.status ?? "unknown"}
                              behindBy={cell?.behindBy}
                              behindOf={cell?.behindOf}
                            />
                          </span>
                        );
                      })}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
