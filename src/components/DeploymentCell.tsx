import { Link } from "react-router-dom";
import { HelpCircle, History, Terminal, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { StatusTag } from "@/components/StatusTag";
import { useRollbackBlockedReason } from "@/components/SessionProvider";
import type { Stage, StackState } from "@/lib/types";
import { absTime, firstLine, relTime, shortSha } from "@/lib/format";

/**
 * One service on one environment, as it appears in a matrix or environment
 * table: what is deployed, how it got there, and the actions for that cell.
 */
export function DeploymentCell({
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
  const rollbackBlocked = useRollbackBlockedReason();

  if (!cell || cell.status === "absent") {
    return (
      <div className="px-1.5 py-1 text-[12px] text-muted-foreground/70">
        <span className="mono">—</span> no deploys
      </div>
    );
  }

  const busy = cell.status === "rolling-back";

  return (
    <div className="group/cell relative rounded px-1.5 py-1 transition-colors hover:bg-[#F2F6FB]">
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          {cell.git ? (
            <>
              <Link
                to={`/service/${encodeURIComponent(service)}/${stage}`}
                className="mono shrink-0 text-[12.5px] font-medium text-primary no-underline hover:underline"
              >
                {shortSha(cell.git.sha)}
              </Link>
              <span className="truncate text-[12px]" title={cell.git.message}>
                {firstLine(cell.git.message, 60)}
              </span>
            </>
          ) : (
            <Tooltip content="This stack carries no git:sha tag, so Control Tower can only report when it was deployed, not what from.">
              <span className="mono cursor-help truncate text-[12.5px]">
                {absTime(cell.lastUpdated)}
              </span>
            </Tooltip>
          )}
        </div>
        <StatusTag status={cell.status} behindBy={cell.behindBy} behindOf={cell.behindOf} />
      </div>

      <div className="mt-[2px] flex h-[22px] items-center gap-2">
        <div className="mono flex min-w-0 flex-1 items-center gap-1.5 truncate text-[10.5px] text-muted-foreground">
          <span>{relTime(cell.lastUpdated)} ago</span>
          {cell.git ? (
            <>
              <span>·</span>
              <a
                href={cell.git.runUrl}
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground no-underline hover:text-primary hover:underline"
              >
                run #{cell.git.runNumber}
              </a>
              <span>·</span>
              <span className="truncate">{cell.git.actor}</span>
            </>
          ) : (
            cell.cfnStatus && (
              <>
                <span>·</span>
                <span className="truncate">{cell.cfnStatus}</span>
                <span className="flex shrink-0 items-center gap-1 opacity-70">
                  <HelpCircle className="h-3 w-3" />
                  no SHA
                </span>
              </>
            )
          )}
        </div>

        <div className="absolute bottom-1 right-1.5 flex items-center gap-1 bg-[#F2F6FB] pl-3 opacity-0 transition-opacity focus-within:opacity-100 group-hover/cell:opacity-100">
          <Button variant="default" size="xs" onClick={() => onLogs(service, stage)} title="Last 10 minutes of logs">
            <Terminal className="h-3 w-3" />
            Logs
          </Button>
          <Button variant="default" size="icon-sm" asChild title="Deployment history">
            <Link to={`/service/${encodeURIComponent(service)}/${stage}`}>
              <History className="h-3 w-3" />
            </Link>
          </Button>
          <Button
            variant={stage === "prod" ? "danger-outline" : "default"}
            size="xs"
            disabled={disabled || busy || Boolean(rollbackBlocked)}
            title={rollbackBlocked ?? undefined}
            onClick={() => onRollback(service, stage)}
          >
            <Undo2 className="h-3 w-3" />
            Roll back
          </Button>
        </div>
      </div>
    </div>
  );
}
