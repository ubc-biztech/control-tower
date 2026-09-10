import { useEffect, useMemo, useRef, useState } from "react";
import {
  AnchorButton,
  Button,
  Callout,
  Classes,
  Dialog,
  DialogBody,
  DialogFooter,
  Icon,
  InputGroup,
  Spinner,
  Tag,
} from "@blueprintjs/core";
import { TowerApiError, getDeployments, getRollbackRun, postRollback } from "@/lib/api";
import type { Deployment, RollbackRun, Stage } from "@/lib/types";
import { absTime, bytes, firstLine, relTime, shortSha } from "@/lib/format";
import { DEPLOYABLES } from "@/mock/world";

export interface RollbackTarget {
  service: string;
  stage: Stage;
  /** Preselected artifact, when launched from a history row. */
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
      .catch((e) => setError({ msg: e instanceof Error ? e.message : "Failed to load deployments" }));
  }, [target]);

  // Poll the (mock) Actions run until it finishes.
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
  const candidates = useMemo(
    () => (deployments ?? []).filter((d) => !d.current),
    [deployments],
  );

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
      if (e instanceof TowerApiError) setError({ msg: e.message, detail: e.detail });
      else setError({ msg: e instanceof Error ? e.message : "Rollback failed to dispatch" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      isOpen={open}
      onClose={onClose}
      canOutsideClickClose={!run || run.status === "completed"}
      style={{ width: 720 }}
      icon={run ? "cloud-upload" : "undo"}
      title={
        <span className="flex items-center gap-2">
          <span>{run ? "Rollback dispatched" : "Roll back"}</span>
          <span className="mono text-[13px]">{target?.service}</span>
          <span style={{ color: "var(--tower-dimmer)" }}>on</span>
          <Tag intent={isProd ? "danger" : "primary"} minimal={!isProd}>
            {target?.stage}
          </Tag>
        </span>
      }
    >
      <DialogBody>
        {run ? (
          <RunProgress run={run} />
        ) : !deployments ? (
          <div className="py-10 text-center">
            <Spinner size={22} />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-[52px_1fr] gap-x-3 gap-y-3">
              <Label>From</Label>
              <DeployLine d={current} emphasis />

              <Label>To</Label>
              <div>
                {candidates.length === 0 ? (
                  <Callout intent="warning" icon="warning-sign" compact>
                    No earlier artifact in the deployment bucket. Serverless keeps only the
                    last 5 packages per stack.
                  </Callout>
                ) : (
                  <div
                    className="overflow-hidden rounded-[2px] border"
                    style={{ borderColor: "var(--tower-edge)" }}
                  >
                    {candidates.map((d) => (
                      <button
                        key={d.timestamp}
                        onClick={() => setSelected(d.timestamp)}
                        className="flex w-full items-start gap-2.5 border-b px-2.5 py-2 text-left last:border-b-0 hover:bg-white/5"
                        style={{
                          borderColor: "var(--tower-edge-soft)",
                          background:
                            selected === d.timestamp ? "rgba(112,228,66,0.08)" : "transparent",
                        }}
                      >
                        <Icon
                          icon={selected === d.timestamp ? "selection" : "circle"}
                          size={12}
                          className="mt-[3px]"
                          color={selected === d.timestamp ? "#70e442" : "#4a535d"}
                        />
                        <div className="min-w-0 flex-1">
                          <DeployLine d={d} />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <Label>Reason</Label>
              <InputGroup
                small
                placeholder="optional — shows in the deployment history and the run summary"
                value={reason}
                onChange={(e) => setReason(e.currentTarget.value)}
              />
            </div>

            <Callout className="!mt-4" icon="git-branch" compact>
              <div className="text-[11.5px]">
                This triggers <code className={Classes.CODE}>rollback.yml</code> in GitHub Actions
                on <span className="mono">ubc-biztech/serverless-biztechapp</span>. Tower never
                runs the Serverless CLI and never writes to AWS. ~2 minutes.
              </div>
              <pre
                className="mono !mb-0 !mt-2 overflow-x-auto rounded-[2px] p-2 text-[11px]"
                style={{ background: "#0b0e12", color: "var(--tower-dim)" }}
              >
{`cd services/${servicePath} && npx sls rollback \\
  --stage ${target?.stage} --timestamp ${selected ?? "<pick one>"} --conceal`}
              </pre>
            </Callout>

            {isProd && (
              <Callout className="!mt-2" intent="danger" icon="warning-sign" compact>
                This redeploys a stored artifact to <b>production</b>. Traffic shifts as soon as
                the stack finishes updating.
              </Callout>
            )}

            {error && (
              <Callout className="!mt-2" intent="danger" icon="error" title={error.msg} compact>
                {error.detail && (
                  <a href={error.detail} target="_blank" rel="noreferrer">
                    View the run in progress
                  </a>
                )}
              </Callout>
            )}
          </>
        )}
      </DialogBody>

      <DialogFooter
        minimal
        actions={
          run ? (
            <>
              <AnchorButton
                icon="share"
                href={run.runUrl}
                target="_blank"
                text="Open Actions run"
              />
              <Button
                intent="primary"
                onClick={onClose}
                disabled={run.status !== "completed"}
                text={run.status === "completed" ? "Done" : "Running…"}
              />
            </>
          ) : (
            <>
              <Button text="Cancel" onClick={onClose} />
              <Button
                intent={isProd ? "danger" : "primary"}
                icon="undo"
                loading={submitting}
                disabled={!selected || !deployments}
                onClick={confirm}
                text={`Roll back ${target?.stage.toUpperCase()}`}
              />
            </>
          )
        }
      />
    </Dialog>
  );
}

function Label({ children }: { children: string }) {
  return (
    <div
      className="pt-[3px] text-[10px] font-bold tracking-[0.09em]"
      style={{ color: "var(--tower-dim)" }}
    >
      {children.toUpperCase()}
    </div>
  );
}

function DeployLine({ d, emphasis }: { d: Deployment | null; emphasis?: boolean }) {
  if (!d) return <span style={{ color: "var(--tower-dimmer)" }}>—</span>;
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        {d.git ? (
          <>
            <span className="mono text-[12.5px]" style={{ color: emphasis ? "#fff" : "#d3d8de" }}>
              {shortSha(d.git.sha)}
            </span>
            <span className="truncate text-[12px]">{firstLine(d.git.message, 62)}</span>
          </>
        ) : (
          <>
            <Tag minimal intent="none" icon="help">
              no git metadata
            </Tag>
            <span className="mono text-[12px]">{absTime(d.datetime)}</span>
          </>
        )}
        {d.kind === "rollback" && (
          <Tag minimal intent="warning">
            rollback
          </Tag>
        )}
        {d.status === "failed" && (
          <Tag minimal intent="danger">
            failed
          </Tag>
        )}
      </div>
      <div className="mono mt-[2px] text-[11px]" style={{ color: "var(--tower-dimmer)" }}>
        deployed {relTime(d.datetime)} ago by {d.actor}
        {d.git ? ` · run #${d.git.runNumber}` : ""} · {bytes(d.sizeBytes)} · ts {d.timestamp}
      </div>
      {d.reason && (
        <div className="mt-[2px] text-[11px] italic" style={{ color: "var(--tower-dim)" }}>
          “{d.reason}”
        </div>
      )}
    </div>
  );
}

function RunProgress({ run }: { run: RollbackRun }) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        {run.status === "completed" ? (
          <Tag intent={run.conclusion === "success" ? "success" : "danger"} large>
            {run.conclusion}
          </Tag>
        ) : (
          <Tag intent="primary" large icon={<Spinner size={12} />}>
            {run.status.replace("_", " ")}
          </Tag>
        )}
        <span className="mono text-[11.5px]" style={{ color: "var(--tower-dimmer)" }}>
          {run.service} · {run.stage} · ts {run.timestamp}
        </span>
      </div>

      <div className="overflow-hidden rounded-[2px] border" style={{ borderColor: "var(--tower-edge)" }}>
        {run.steps.map((s) => (
          <div
            key={s.name}
            className="flex items-center gap-2.5 border-b px-3 py-1.5 text-[12px] last:border-b-0"
            style={{ borderColor: "var(--tower-edge-soft)" }}
          >
            {s.status === "running" ? (
              <Spinner size={12} />
            ) : (
              <Icon
                icon={s.status === "done" ? "tick" : s.status === "failed" ? "cross" : "minus"}
                size={12}
                color={s.status === "done" ? "#70e442" : s.status === "failed" ? "#e53e5a" : "#454e58"}
              />
            )}
            <span
              className="mono"
              style={{ color: s.status === "pending" ? "var(--tower-dimmer)" : undefined }}
            >
              {s.name}
            </span>
          </div>
        ))}
      </div>

      {run.reason && (
        <div className="mt-3 text-[12px]" style={{ color: "var(--tower-dim)" }}>
          Reason: “{run.reason}”
        </div>
      )}

      {run.status === "completed" && (
        <Callout className="!mt-3" intent="success" icon="tick-circle" compact>
          The stack now serves the rolled-back artifact. It appears in the deployment history
          as a distinct <b>rollback</b> row.
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
