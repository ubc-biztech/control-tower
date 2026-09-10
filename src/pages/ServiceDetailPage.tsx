import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ChevronLeft,
  Dot,
  ExternalLink,
  HelpCircle,
  RefreshCw,
  Terminal,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Chip } from "@/components/ui/badge";
import { Callout } from "@/components/ui/callout";
import { CenteredSpinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusTag } from "@/components/StatusTag";
import { useRollbackBlockedReason } from "@/components/SessionProvider";
import { getDeployments, getStackFunctions } from "@/lib/api";
import type { Deployment, MatrixResponse, Stage } from "@/lib/types";
import { STAGES, cellKey } from "@/lib/types";
import { absTime, bytes, firstLine, relTime, shortSha } from "@/lib/format";
import { AWS_REGION, DEPLOYABLES } from "@/mock/world";
import { cn } from "@/lib/utils";

export function ServiceDetailPage({
  matrix,
  onLogs,
  onRollback,
  reloadToken,
}: {
  matrix: MatrixResponse | null;
  onLogs: (s: string, st: Stage) => void;
  onRollback: (s: string, st: Stage, timestamp?: string) => void;
  reloadToken: number;
}) {
  const params = useParams<{ name: string; stage: string }>();
  const service = decodeURIComponent(params.name ?? "");
  const stage = (params.stage ?? "prod") as Stage;

  const [rows, setRows] = useState<Deployment[] | null>(null);
  const [functions, setFunctions] = useState<string[] | null>(null);
  const rollbackBlocked = useRollbackBlockedReason();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getDeployments(service, stage)
      .then(setRows)
      .catch((e) => {
        setRows(null);
        setError(e instanceof Error ? e.message : "Failed to load deployments");
      })
      .finally(() => setLoading(false));
  }, [service, stage]);

  useEffect(load, [load, reloadToken]);

  // Functions are discovered from the stack's resources, not from config, so
  // new ones show up without anybody editing deployables.json (R3.2).
  useEffect(() => {
    setFunctions(null);
    if (!getStackFunctions) return;
    let cancelled = false;
    getStackFunctions(service, stage)
      .then((r) => !cancelled && setFunctions(r.lambdaFunctionNames))
      .catch(() => !cancelled && setFunctions([]));
    return () => {
      cancelled = true;
    };
  }, [service, stage]);

  const deployable = DEPLOYABLES.find((d) => d.name === service);
  const cell = matrix?.cells[cellKey(service, stage)];
  const stackName = deployable?.stackPattern.replace("{stage}", stage) ?? `${service}-${stage}`;
  const cfnUrl = `https://${AWS_REGION}.console.aws.amazon.com/cloudformation/home?region=${AWS_REGION}#/stacks/stackinfo?stackId=${encodeURIComponent(stackName)}`;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-border bg-card px-5 py-4">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon-sm" asChild className="mt-0.5">
            <Link to="/">
              <ChevronLeft className="h-4 w-4" />
            </Link>
          </Button>

          <div className="min-w-0 flex-1">
            <h1 className="mono flex flex-wrap items-center gap-2 text-[19px] font-bold leading-tight">
              {service}
              {cell && (
                <StatusTag status={cell.status} behindBy={cell.behindBy} behindOf={cell.behindOf} />
              )}
            </h1>
            <div className="mono mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-muted-foreground">
              <span>stack {stackName}</span>
              <span>·</span>
              <span>
                {deployable?.repo}/{deployable?.path}
              </span>
              <span>·</span>
              <span>
                {functions ? `${functions.length} functions` : "discovering functions…"}
              </span>
              {cell?.cfnStatus && (
                <>
                  <span>·</span>
                  <span>{cell.cfnStatus}</span>
                </>
              )}
              <a
                href={cfnUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-primary no-underline hover:underline"
              >
                CloudFormation
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <div className="flex items-center gap-1">
              {STAGES.map((s) => (
                <Link
                  key={s}
                  to={`/service/${encodeURIComponent(service)}/${s}`}
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
            <Button size="sm" onClick={() => onLogs(service, stage)}>
              <Terminal className="h-3 w-3" />
              Logs
            </Button>
            <Button size="icon-sm" onClick={load} title="Refresh">
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            </Button>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-5">
        <Callout tone="info" className="mb-3">
          History comes from the stack's deployment bucket (
          <span className="mono">sls deploy list</span>). Serverless keeps the last 5 packages.{" "}
          {rows?.some((d) => d.git) ? (
            <>
              <b>Only the current deploy carries a git SHA</b> — it lives in the stack tags, not in
              S3, so earlier artifacts show a timestamp only.
            </>
          ) : (
            <>
              <b>S3 records a timestamp and a size, and nothing else</b> — no commit, no author. The
              stack tags would carry the SHA for the current deploy, but the pipeline does not stamp
              them yet.
            </>
          )}
        </Callout>

        {error && (
          <Callout tone={error.includes("No stack") ? "warning" : "danger"} title={error}>
            {error.includes("No stack")
              ? `Nothing has ever been deployed to ${stage} for this service.`
              : "Control Tower could not read the deployment bucket."}
          </Callout>
        )}

        {!rows && loading && <CenteredSpinner label="Listing artifacts…" />}

        {rows && rows.length === 0 && !error && (
          <Callout tone="warning" title="No artifacts in the deployment bucket">
            This service has never been deployed to {stage}.
          </Callout>
        )}

        {rows && rows.length > 0 && (
          <div className="overflow-hidden rounded border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead style={{ width: 28 }} />
                  <TableHead>Deployment</TableHead>
                  <TableHead style={{ width: 168 }}>Deployed</TableHead>
                  <TableHead style={{ width: 130 }}>By</TableHead>
                  <TableHead style={{ width: 80 }}>Size</TableHead>
                  <TableHead style={{ width: 150 }}>Artifact ts</TableHead>
                  <TableHead style={{ width: 118 }} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((d) => (
                  <TableRow key={d.timestamp}>
                    <TableCell className="!px-1">
                      {d.current && (
                        <Dot
                          className={cn(
                            "h-5 w-5",
                            d.status === "failed" ? "text-status-red-fg" : "text-status-green-fg",
                          )}
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2">
                        {d.git ? (
                          <>
                            <span className="mono text-[12.5px] font-medium">{shortSha(d.git.sha)}</span>
                            <span className="text-[12px]">{firstLine(d.git.message, 76)}</span>
                            <Chip>{d.git.ref}</Chip>
                          </>
                        ) : (
                          <Badge tone="gray">
                            <HelpCircle className="h-2.5 w-2.5" />
                            no git metadata
                          </Badge>
                        )}
                        {d.current && (
                          <Badge tone={d.status === "failed" ? "red" : "green"}>
                            {d.status === "failed" ? "failed" : "current"}
                          </Badge>
                        )}
                        {d.kind === "rollback" && (
                          <Badge tone="amber">
                            <Undo2 className="h-2.5 w-2.5" />
                            rollback
                          </Badge>
                        )}
                      </div>
                      {d.reason && (
                        <div className="mt-[3px] text-[11px] italic text-muted-foreground">
                          “{d.reason}”
                        </div>
                      )}
                      <div className="mono mt-[3px] truncate text-[10.5px] text-muted-foreground/70">
                        s3://…/{d.artifactKey}
                      </div>
                    </TableCell>
                    <TableCell className="mono whitespace-nowrap text-[11.5px]">
                      {relTime(d.datetime)} ago
                      <div className="text-[10.5px] text-muted-foreground">{absTime(d.datetime)}</div>
                    </TableCell>
                    <TableCell className="mono text-[11.5px]">
                      {d.actor ?? <span className="text-muted-foreground/60">not recorded</span>}
                      {d.git && (
                        <div>
                          <a
                            href={d.git.runUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10.5px] text-primary hover:underline"
                          >
                            run #{d.git.runNumber}
                          </a>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="mono text-[11.5px] text-muted-foreground">
                      {bytes(d.sizeBytes)}
                    </TableCell>
                    <TableCell className="mono text-[11.5px] text-muted-foreground">
                      {d.timestamp}
                    </TableCell>
                    <TableCell>
                      {!d.current && (
                        <Button
                          size="sm"
                          variant={stage === "prod" ? "danger-outline" : "default"}
                          disabled={
                            cell?.status === "rolling-back" ||
                            matrix?.stale ||
                            Boolean(rollbackBlocked)
                          }
                          title={rollbackBlocked ?? `Roll back to artifact ${d.timestamp}`}
                          onClick={() => onRollback(service, stage, d.timestamp)}
                        >
                          <Undo2 className="h-3 w-3" />
                          Roll back
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
