import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AnchorButton,
  Button,
  ButtonGroup,
  Callout,
  Spinner,
  Tag,
} from "@blueprintjs/core";
import { getDeployments } from "@/lib/api";
import type { Deployment, MatrixResponse, Stage } from "@/lib/types";
import { STAGES, cellKey } from "@/lib/types";
import { absTime, bytes, firstLine, relTime, shortSha } from "@/lib/format";
import { StatusTag } from "@/components/StatusTag";
import { AWS_REGION, DEPLOYABLES } from "@/mock/world";

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

  const deployable = DEPLOYABLES.find((d) => d.name === service);
  const cell = matrix?.cells[cellKey(service, stage)];
  const stackName = deployable?.stackPattern.replace("{stage}", stage) ?? `${service}-${stage}`;
  const cfnUrl = `https://${AWS_REGION}.console.aws.amazon.com/cloudformation/home?region=${AWS_REGION}#/stacks/stackinfo?stackId=${encodeURIComponent(stackName)}`;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        className="shrink-0 border-b px-4 py-2.5"
        style={{ borderColor: "var(--tower-edge)", background: "var(--tower-panel)" }}
      >
        <div className="flex items-center gap-2">
          <Link to="/" className="bp5-button bp5-minimal bp5-small">
            <span className="bp5-icon bp5-icon-chevron-left" />
          </Link>
          <span className="mono text-[15px] font-bold text-white">{service}</span>
          {cell && <StatusTag status={cell.status} behindBy={cell.behindBy} behindOf={cell.behindOf} />}
          <div className="flex-1" />
          <ButtonGroup>
            {STAGES.map((s) => (
              <Link
                key={s}
                to={`/service/${encodeURIComponent(service)}/${s}`}
                className={`bp5-button bp5-small ${s === stage ? "bp5-active" : ""}`}
              >
                {s}
              </Link>
            ))}
          </ButtonGroup>
          <Button small icon="console" text="Logs" onClick={() => onLogs(service, stage)} />
          <Button small icon="refresh" loading={loading} onClick={load} />
        </div>

        <div className="mono mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]" style={{ color: "var(--tower-dimmer)" }}>
          <span>stack {stackName}</span>
          <span>·</span>
          <span>{deployable?.repo}/{deployable?.path}</span>
          <span>·</span>
          <span>{deployable?.functions.length ?? 0} functions</span>
          {cell?.cfnStatus && (
            <>
              <span>·</span>
              <span>{cell.cfnStatus}</span>
            </>
          )}
          <AnchorButton minimal small icon="share" href={cfnUrl} target="_blank" className="!text-[10.5px]">
            CloudFormation
          </AnchorButton>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="px-4 pt-3">
          <Callout icon="info-sign" compact>
            <span className="text-[11.5px]">
              History comes from the stack's deployment bucket (<span className="mono">sls deploy list</span>).
              Serverless keeps the last 5 packages. <b>Only the current deploy carries a git SHA</b> —
              it lives in the stack tags, not in S3, so earlier artifacts show a timestamp only.
            </span>
          </Callout>
        </div>

        {error && (
          <div className="p-4">
            <Callout intent={error.includes("No stack") ? "warning" : "danger"} icon="offline" title={error}>
              {error.includes("No stack")
                ? `Nothing has ever been deployed to ${stage} for this service.`
                : "Tower could not read the deployment bucket."}
            </Callout>
          </div>
        )}

        {!rows && loading && (
          <div className="pt-16 text-center">
            <Spinner size={22} />
          </div>
        )}

        {rows && rows.length === 0 && !error && (
          <div className="p-4">
            <Callout intent="warning" icon="warning-sign" title="No artifacts in the deployment bucket">
              This service has never been deployed to {stage}.
            </Callout>
          </div>
        )}

        {rows && rows.length > 0 && (
          <table className="tower-table mt-3">
            <thead>
              <tr>
                <th style={{ width: 30 }} />
                <th>Deployment</th>
                <th style={{ width: 178 }}>Deployed</th>
                <th style={{ width: 140 }}>By</th>
                <th style={{ width: 110 }}>Size</th>
                <th style={{ width: 200 }}>Artifact timestamp</th>
                <th style={{ width: 132 }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.timestamp}>
                  <td>
                    {d.current ? (
                      <span
                        className="bp5-icon bp5-icon-dot"
                        style={{ color: d.status === "failed" ? "#e53e5a" : "#70e442" }}
                      />
                    ) : null}
                  </td>
                  <td>
                    <div className="flex flex-wrap items-center gap-2">
                      {d.git ? (
                        <>
                          <span className="mono text-[12.5px] text-white">{shortSha(d.git.sha)}</span>
                          <span className="text-[12px]">{firstLine(d.git.message, 78)}</span>
                          <Tag minimal>{d.git.ref}</Tag>
                        </>
                      ) : (
                        <Tag minimal icon="help">
                          no git metadata
                        </Tag>
                      )}
                      {d.current && (
                        <Tag intent={d.status === "failed" ? "danger" : "success"} minimal={d.status === "failed"}>
                          {d.status === "failed" ? "failed" : "current"}
                        </Tag>
                      )}
                      {d.kind === "rollback" && (
                        <Tag intent="warning" minimal icon="undo">
                          rollback
                        </Tag>
                      )}
                    </div>
                    {d.reason && (
                      <div className="mt-[3px] text-[11px] italic" style={{ color: "var(--tower-dim)" }}>
                        “{d.reason}”
                      </div>
                    )}
                    <div className="mono mt-[3px] truncate text-[10.5px]" style={{ color: "var(--tower-dimmer)" }}>
                      s3://…/{d.artifactKey}
                    </div>
                  </td>
                  <td className="mono whitespace-nowrap text-[11.5px]">
                    {relTime(d.datetime)} ago
                    <div className="text-[10.5px]" style={{ color: "var(--tower-dimmer)" }}>
                      {absTime(d.datetime)}
                    </div>
                  </td>
                  <td className="mono text-[11.5px]">
                    {d.actor}
                    {d.git && (
                      <div>
                        <a href={d.git.runUrl} target="_blank" rel="noreferrer" className="text-[10.5px]">
                          run #{d.git.runNumber}
                        </a>
                      </div>
                    )}
                  </td>
                  <td className="mono text-[11.5px]" style={{ color: "var(--tower-dim)" }}>
                    {bytes(d.sizeBytes)}
                  </td>
                  <td className="mono text-[11.5px]" style={{ color: "var(--tower-dim)" }}>
                    {d.timestamp}
                  </td>
                  <td>
                    {!d.current && (
                      <Button
                        small
                        outlined
                        className="!whitespace-nowrap"
                        icon="undo"
                        intent={stage === "prod" ? "danger" : "primary"}
                        disabled={cell?.status === "rolling-back" || matrix?.stale}
                        onClick={() => onRollback(service, stage, d.timestamp)}
                        title={`Roll back to artifact ${d.timestamp}`}
                        text="Roll back"
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
