import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  CircleDot,
  Circle,
  ExternalLink,
  HelpCircle,
  Loader2,
  Minus,
  Undo2,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Callout } from "@/components/ui/callout";
import { CenteredSpinner } from "@/components/ui/spinner";
import { ApiError, getDeployments, getRollbackRun, postRollback } from "@/lib/api";
import type { Deployment, RollbackRun, Stage } from "@/lib/types";
import { absTime, bytes, firstLine, relTime, shortSha } from "@/lib/format";
import { DEPLOYABLES } from "@/mock/world";
import { useRollbackBlockedReason } from "@/components/HealthProvider";
import { cn } from "@/lib/utils";

export interface RollbackTarget {
  service: string;
  stage: Stage;
  timestamp?: string;
}

export function RollbackDialog({
  target,
  onClose,
  onCompleted,
  onDispatched,
}: {
  target: RollbackTarget | null;
  onClose: () => void;
  onCompleted?: () => void;
  onDispatched?: () => void;
}) {
  const [deployments, setDeployments] = useState<Deployment[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [run, setRun] = useState<RollbackRun | null>(null);
  const [error, setError] = useState<{ msg: string; detail?: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const pollRef = useRef<number | null>(null);

  const open = Boolean(target);

  useEffect(() => {
    if (!target) return;
    setDeployments(null);
    setRun(null);
    setError(null);
    setReason("");
    setSelected(target.timestamp ?? null);
    getDeployments(target.service, target.stage)
      .then((d) => {
        setDeployments(d);
        setSelected((prev) => prev ?? d.find((x) => !x.current)?.timestamp ?? null);
      })
      .catch((e) =>
        setError({ msg: e instanceof Error ? e.message : "Failed to load deployments" }),
      );
  }, [target]);

  useEffect(() => {
    if (!run || run.status === "completed") return;
    pollRef.current = window.setInterval(async () => {
      try {
        const next = await getRollbackRun(run.runId);
        setRun(next);
        if (next.status === "completed") onCompleted?.();
      } catch {
        /* transient */
      }
    }, 900);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [run, onCompleted]);

  const current = useMemo(() => deployments?.find((d) => d.current) ?? null, [deployments]);
  const candidates = useMemo(() => (deployments ?? []).filter((d) => !d.current), [deployments]);

  const blocked = useRollbackBlockedReason();
  const isProd = target?.stage === "prod";
  const servicePath = target ? servicePathFor(target.service) : "";

  const confirm = async () => {
    if (!target || !selected) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await postRollback({
        service: target.service,
        stage: target.stage,
        timestamp: selected,
        reason: reason.trim() || undefined,
      });
      setRun(r);
      onDispatched?.();
    } catch (e) {
      if (e instanceof ApiError) setError({ msg: e.message, detail: e.detail });
      else setError({ msg: e instanceof Error ? e.message : "Rollback failed to dispatch" });
    } finally {
      setSubmitting(false);
    }
  };

  const locked = Boolean(run && run.status !== "completed");

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !locked && onClose()}>
      <DialogContent hideClose={locked} onEscapeKeyDown={(e) => locked && e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>
            {run ? "Rollback dispatched" : "Roll back"}
            <span className="mono text-[14px]">{target?.service}</span>
            <span className="font-normal text-muted-foreground">on</span>
            <Badge tone={isProd ? "red" : "blue"}>{target?.stage}</Badge>
          </DialogTitle>
        </DialogHeader>

        <DialogBody>
          {run ? (
            <RunProgress run={run} />
          ) : !deployments ? (
            <CenteredSpinner label="Reading the deployment bucket…" />
          ) : (
            <>
              <div className="grid grid-cols-[58px_1fr] gap-x-3 gap-y-4">
                <Label>From</Label>
                <DeployLine d={current} emphasis />

                <Label>To</Label>
                <div>
                  {candidates.length === 0 ? (
                    <Callout tone="warning">
                      No earlier artifact in the deployment bucket. Serverless keeps only the last 5
                      packages per stack.
                    </Callout>
                  ) : (
                    <div className="divide-y divide-border overflow-hidden rounded border border-border">
                      {candidates.map((d) => {
                        const active = selected === d.timestamp;
                        return (
                          <button
                            key={d.timestamp}
                            onClick={() => setSelected(d.timestamp)}
                            className={cn(
                              "flex w-full items-start gap-2.5 px-2.5 py-2 text-left transition-colors",
                              active ? "bg-status-blue-bg" : "bg-card hover:bg-secondary",
                            )}
                          >
                            {active ? (
                              <CircleDot className="mt-[3px] h-3.5 w-3.5 shrink-0 text-primary" />
                            ) : (
                              <Circle className="mt-[3px] h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                            )}
                            <div className="min-w-0 flex-1">
                              <DeployLine d={d} />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <Label>Reason</Label>
                <Input
                  placeholder="optional — shows in the deployment history and the run summary"
                  value={reason}
                  onChange={(e) => setReason(e.currentTarget.value)}
                />
              </div>

              <Callout tone="neutral" icon={false} className="mt-4">
                <div className="text-[11.5px] leading-relaxed">
                  This triggers <code className="mono rounded bg-white px-1 py-[1px] text-[11px]">rollback.yml</code>{" "}
                  in GitHub Actions on{" "}
                  <span className="mono">ubc-biztech/serverless-biztechapp</span>. Control Tower never runs
                  the Serverless CLI and never writes to AWS. Takes about 2 minutes.
                </div>
                <pre className="mono mt-2 overflow-x-auto rounded border border-border bg-[#0D172C] px-2.5 py-2 text-[11px] leading-relaxed text-[#A2B1D5]">
{`cd services/${servicePath} && npx sls rollback \\
  --stage ${target?.stage} --timestamp ${selected ?? "<pick one>"} --conceal`}
                </pre>
              </Callout>

              {blocked && (
                <Callout tone="warning" className="mt-2" title="Read-only build">
                  {blocked}
                </Callout>
              )}

              {isProd && !blocked && (
                <Callout tone="danger" className="mt-2">
                  This redeploys a stored artifact to <b>production</b>. Traffic shifts as soon as
                  the stack finishes updating.
                </Callout>
              )}

              {error && (
                <Callout tone="danger" className="mt-2" title={error.msg}>
                  {error.detail && (
                    <a href={error.detail} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                      View the run in progress
                    </a>
                  )}
                </Callout>
              )}
            </>
          )}
        </DialogBody>

        <DialogFooter>
          {run ? (
            <>
              <Button variant="default" asChild>
                <a href={run.runUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open Actions run
                </a>
              </Button>
              <Button variant="primary" onClick={onClose} disabled={run.status !== "completed"}>
                {run.status === "completed" ? "Done" : "Running…"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="default" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant={isProd ? "danger" : "primary"}
                loading={submitting}
                disabled={!selected || !deployments || Boolean(blocked)}
                title={blocked ?? undefined}
                onClick={confirm}
              >
                {!submitting && <Undo2 className="h-3.5 w-3.5" />}
                Roll back {target?.stage.toUpperCase()}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Label({ children }: { children: string }) {
  return <div className="eyebrow pt-[5px] text-muted-foreground">{children}</div>;
}

function DeployLine({ d, emphasis }: { d: Deployment | null; emphasis?: boolean }) {
  if (!d) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        {d.git ? (
          <>
            <span className={cn("mono text-[12.5px] font-medium", emphasis && "text-foreground")}>
              {shortSha(d.git.sha)}
            </span>
            <span className="truncate text-[12px]">{firstLine(d.git.message, 62)}</span>
          </>
        ) : (
          <>
            <Badge tone="gray">
              <HelpCircle className="h-2.5 w-2.5" />
              no git metadata
            </Badge>
            <span className="mono text-[12px]">{absTime(d.datetime)}</span>
          </>
        )}
        {d.kind === "rollback" && <Badge tone="amber">rollback</Badge>}
        {d.status === "failed" && <Badge tone="red">failed</Badge>}
      </div>
      <div className="mono mt-[2px] text-[11px] text-muted-foreground">
        deployed {relTime(d.datetime)} ago by {d.actor}
        {d.git ? ` · run #${d.git.runNumber}` : ""} · {bytes(d.sizeBytes)} · ts {d.timestamp}
      </div>
      {d.reason && <div className="mt-[2px] text-[11px] italic text-muted-foreground">“{d.reason}”</div>}
    </div>
  );
}

function RunProgress({ run }: { run: RollbackRun }) {
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {run.status === "completed" ? (
          <Badge tone={run.conclusion === "success" ? "green" : "red"}>{run.conclusion}</Badge>
        ) : (
          <Badge tone="blue">
            <Loader2 className="h-2.5 w-2.5 animate-spin" />
            {run.status.replace("_", " ")}
          </Badge>
        )}
        <span className="mono text-[11.5px] text-muted-foreground">
          {run.service} · {run.stage} · ts {run.timestamp}
        </span>
      </div>

      <div className="divide-y divide-border overflow-hidden rounded border border-border">
        {run.steps.map((s) => (
          <div key={s.name} className="flex items-center gap-2.5 px-3 py-1.5 text-[12px]">
            {s.status === "running" ? (
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
            ) : s.status === "done" ? (
              <Check className="h-3.5 w-3.5 shrink-0 text-status-green-fg" />
            ) : s.status === "failed" ? (
              <X className="h-3.5 w-3.5 shrink-0 text-status-red-fg" />
            ) : (
              <Minus className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
            )}
            <span className={cn("mono", s.status === "pending" && "text-muted-foreground/60")}>
              {s.name}
            </span>
          </div>
        ))}
      </div>

      {run.reason && (
        <div className="mt-3 text-[12px] text-muted-foreground">Reason: “{run.reason}”</div>
      )}

      {run.status === "completed" && (
        <Callout tone="success" className="mt-3">
          The stack now serves the rolled-back artifact. It appears in the deployment history as a
          distinct <b>rollback</b> row.
        </Callout>
      )}
    </div>
  );
}

/** Stack/service name -> the folder under services/ that the workflow cds into. */
function servicePathFor(service: string) {
  const d = DEPLOYABLES.find((x) => x.name === service);
  return d ? d.path.replace(/^services\//, "") : service;
}
