import { useMemo, useState } from "react";
import { Button, ButtonGroup, Callout, InputGroup, Spinner, Tag, Tooltip } from "@blueprintjs/core";
import { Link } from "react-router-dom";
import { StatusTag } from "@/components/StatusTag";
import type { MatrixResponse, Stage, StackState } from "@/lib/types";
import { STAGES, cellKey } from "@/lib/types";
import { firstLine, relTime, shortSha } from "@/lib/format";

export function MatrixPage({
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
      if (needle && !d.name.toLowerCase().includes(needle) && !d.path.toLowerCase().includes(needle))
        return false;
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
    const c = { failed: 0, behind: 0, unknown: 0, absent: 0, current: 0, rolling: 0 };
    if (data)
      for (const cell of Object.values(data.cells)) {
        if (cell.status === "rolling-back") c.rolling++;
        else if (cell.status === "current") c.current++;
        else if (cell.status === "failed") c.failed++;
        else if (cell.status === "behind") c.behind++;
        else if (cell.status === "unknown") c.unknown++;
        else c.absent++;
      }
    return c;
  }, [data]);

  if (error && !data) {
    return (
      <div className="p-6">
        <Callout intent="danger" icon="offline" title="Cannot reach AWS">
          {error} — Tower has no cached state to fall back on yet.
        </Callout>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Toolbar */}
      <div
        className="flex shrink-0 items-center gap-3 border-b px-4 py-2.5"
        style={{ borderColor: "var(--tower-edge)", background: "var(--tower-panel)" }}
      >
        <div>
          <div className="text-[14px] font-bold leading-none text-white">Environments</div>
          <div className="mt-1 text-[11px]" style={{ color: "var(--tower-dimmer)" }}>
            What is deployed where, from CloudFormation stack tags
          </div>
        </div>

        <div className="mx-2 h-7 w-px" style={{ background: "var(--tower-edge)" }} />

        <div className="flex items-center gap-3 text-[11px]">
          <Stat label="services" value={data?.deployables.length ?? 0} />
          <Stat label="current" value={counts.current} tone="#70e442" />
          <Stat label="behind" value={counts.behind} tone="#d9822b" />
          <Stat label="failed" value={counts.failed} tone="#e53e5a" />
          <Stat label="no deploys" value={counts.absent} />
        </div>

        <div className="flex-1" />

        <ButtonGroup>
          <Button small active={only === "all"} onClick={() => setOnly("all")} text="All" />
          <Button
            small
            active={only === "attention"}
            onClick={() => setOnly("attention")}
            icon="warning-sign"
            text="Needs attention"
          />
        </ButtonGroup>
        <InputGroup
          small
          leftIcon="search"
          className="w-[220px]"
          placeholder="Filter services"
          value={q}
          onChange={(e) => setQ(e.currentTarget.value)}
        />
      </div>

      {data?.stale && (
        <div className="px-4 pt-3">
          <Callout intent="warning" icon="outdated" compact title="Showing last-known state">
            AWS is unreachable. Nothing here is confirmed live, and rollback is disabled until
            Tower can read CloudFormation again.
          </Callout>
        </div>
      )}

      {/* Matrix */}
      <div className="min-h-0 flex-1 overflow-auto">
        {!data && loading ? (
          <div className="pt-24 text-center">
            <Spinner size={26} />
          </div>
        ) : (
          <table className="tower-table">
            <thead>
              <tr>
                <th style={{ width: 252 }}>Service</th>
                {STAGES.map((s) => (
                  <th key={s}>
                    <span className="flex items-center gap-1.5">
                      {s}
                      {s === "prod" && (
                        <Tag minimal intent="danger">
                          live
                        </Tag>
                      )}
                      {s === "staging" && (
                        <Tag minimal>no pipeline</Tag>
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.name}>
                  <td>
                    <Link
                      to={`/service/${encodeURIComponent(d.name)}/prod`}
                      className="mono whitespace-nowrap text-[12.5px] text-white no-underline hover:underline"
                    >
                      {d.name}
                    </Link>
                    <div className="mono mt-[2px] text-[10.5px]" style={{ color: "var(--tower-dimmer)" }}>
                      {d.path} · {d.functions.length} fn
                    </div>
                  </td>
                  {STAGES.map((stage) => (
                    <td key={stage} className="!p-1">
                      <Cell
                        cell={data!.cells[cellKey(d.name, stage)]}
                        service={d.name}
                        stage={stage}
                        disabled={Boolean(data?.stale)}
                        onLogs={onLogs}
                        onRollback={onRollback}
                      />
                    </td>
                  ))}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="!py-10 text-center" style={{ color: "var(--tower-dimmer)" }}>
                    No services match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="mono text-[14px] font-bold" style={{ color: tone ?? "#d3d8de" }}>
        {value}
      </span>
      <span style={{ color: "var(--tower-dimmer)" }}>{label}</span>
    </span>
  );
}

function Cell({
  cell,
  service,
  stage,
  disabled,
  onLogs,
  onRollback,
}: {
  cell: StackState | undefined;
  service: string;
  stage: Stage;
  disabled: boolean;
  onLogs: (s: string, st: Stage) => void;
  onRollback: (s: string, st: Stage) => void;
}) {
  if (!cell || cell.status === "absent") {
    return (
      <div className="matrix-cell is-absent">
        <span className="text-[12px]" style={{ color: "var(--tower-dimmer)" }}>
          no deploys
        </span>
      </div>
    );
  }

  const busy = cell.status === "rolling-back";

  return (
    <div className="matrix-cell group">
      {/* line 1 — what is deployed */}
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          {cell.git ? (
            <>
              <Link
                to={`/service/${encodeURIComponent(service)}/${stage}`}
                className="mono shrink-0 text-[12.5px] text-white no-underline hover:underline"
              >
                {shortSha(cell.git.sha)}
              </Link>
              <span className="truncate text-[12px]" title={cell.git.message}>
                {firstLine(cell.git.message, 52)}
              </span>
            </>
          ) : (
            <Tooltip
              compact
              content="Deployed before the pipeline started stamping git:sha onto the stack"
            >
              <Tag minimal icon="help">
                no git metadata
              </Tag>
            </Tooltip>
          )}
        </div>
        <div className="shrink-0">
          <StatusTag status={cell.status} behindBy={cell.behindBy} behindOf={cell.behindOf} />
        </div>
      </div>

      {/* line 2 — provenance, swapped for actions on hover */}
      <div className="mt-[2px] flex h-[20px] items-center gap-2">
        <div
          className="mono flex min-w-0 flex-1 items-center gap-1.5 truncate text-[10.5px]"
          style={{ color: "var(--tower-dimmer)" }}
        >
          <span>{relTime(cell.lastUpdated)} ago</span>
          {cell.git && (
            <>
              <span>·</span>
              <a
                href={cell.git.runUrl}
                target="_blank"
                rel="noreferrer"
                className="no-underline hover:underline"
                style={{ color: "var(--tower-dimmer)" }}
              >
                run #{cell.git.runNumber}
              </a>
              <span>·</span>
              <span className="truncate">{cell.git.actor}</span>
            </>
          )}
          {!cell.git && cell.cfnStatus && <span>· {cell.cfnStatus}</span>}
        </div>

        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            small
            minimal
            icon="console"
            title="Last 10 minutes of logs"
            onClick={() => onLogs(service, stage)}
          />
          <Link
            to={`/service/${encodeURIComponent(service)}/${stage}`}
            className="bp5-button bp5-minimal bp5-small"
            title="Deployment history"
          >
            <span className="bp5-icon bp5-icon-history" />
          </Link>
          <Button
            small
            minimal
            icon="undo"
            text="Rollback"
            intent={stage === "prod" ? "danger" : "none"}
            disabled={disabled || busy}
            onClick={() => onRollback(service, stage)}
          />
        </div>
      </div>
    </div>
  );
}
