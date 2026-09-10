import { Eye, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tooltip } from "@/components/ui/tooltip";
import { isSimulatingOutage, setSimulateOutage } from "@/lib/api";
import { relTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/** The bar above the page content: read-only assurance, freshness, refresh. */
export function TopBar({
  fetchedAt,
  stale,
  loading,
  onRefresh,
}: {
  fetchedAt?: string | null;
  stale?: boolean;
  loading?: boolean;
  onRefresh?: () => void;
}) {
  return (
    <header className="flex h-[52px] shrink-0 items-center gap-3 border-b border-border bg-card px-5">
      <Tooltip content="Control Tower reads AWS and can trigger exactly one thing: a rollback, in GitHub Actions.">
        <span className="flex cursor-help items-center gap-1.5 rounded-sm border border-status-green-line bg-status-green-bg px-1.5 py-[2px] text-[10px] font-bold uppercase tracking-[0.05em] text-status-green-fg">
          <Eye className="h-3 w-3" />
          read-only
        </span>
      </Tooltip>

      <div className="flex-1" />

      <Tooltip content="Simulate AWS being unreachable, to exercise the stale-state path (R1.7)">
        <label className="flex cursor-pointer items-center gap-1.5 text-[11.5px] text-muted-foreground">
          <Switch
            checked={isSimulatingOutage()}
            onCheckedChange={(v) => {
              setSimulateOutage(v);
              onRefresh?.();
            }}
          />
          simulate outage
        </label>
      </Tooltip>

      <div className="h-5 w-px bg-border" />

      {fetchedAt && (
        <span
          className={cn(
            "mono text-[11px]",
            stale ? "font-medium text-status-amber-fg" : "text-muted-foreground",
          )}
        >
          {stale ? "stale as of" : "updated"} {relTime(fetchedAt)} ago
        </span>
      )}
      {onRefresh && (
        <Button size="icon-sm" onClick={onRefresh} title="Refresh">
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
        </Button>
      )}
    </header>
  );
}
