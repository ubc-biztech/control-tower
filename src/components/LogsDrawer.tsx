import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, Filter, RefreshCw, Search, X } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Callout } from "@/components/ui/callout";
import { CenteredSpinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { getLogs } from "@/lib/api";
import type { LogsResponse, Stage } from "@/lib/types";
import { logTime, shortFn } from "@/lib/format";
import { cn } from "@/lib/utils";

const AUTO_REFRESH_MS = 10_000;

const LEVEL_STYLE: Record<string, string> = {
  ERROR: "border-l-status-red-fg bg-status-red-bg/50 text-status-red-fg",
  WARN: "border-l-status-amber-fg text-status-amber-fg",
  INFO: "border-l-transparent",
  START: "border-l-transparent text-muted-foreground/70",
  END: "border-l-transparent text-muted-foreground/70",
  REPORT: "border-l-transparent text-muted-foreground/70",
};

export function LogsDrawer({
  service,
  stage,
  onClose,
}: {
  service: string | null;
  stage: Stage | null;
  onClose: () => void;
}) {
  const [filter, setFilter] = useState("");
  const [applied, setApplied] = useState("");
  const [data, setData] = useState<LogsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [auto, setAuto] = useState(true);
  const [lastAt, setLastAt] = useState<number | null>(null);
  const open = Boolean(service && stage);
  const reqRef = useRef(0);

  const load = useCallback(
    async (f: string) => {
      if (!service || !stage) return;
      const id = ++reqRef.current;
      setLoading(true);
      setError(null);
      try {
        const res = await getLogs(service, stage, f || undefined);
        if (id !== reqRef.current) return;
        setData(res);
        setLastAt(Date.now());
      } catch (e) {
        if (id !== reqRef.current) return;
        setError(e instanceof Error ? e.message : "Failed to read logs");
      } finally {
        if (id === reqRef.current) setLoading(false);
      }
    },
    [service, stage],
  );

  useEffect(() => {
    if (!open) return;
    setFilter("");
    setApplied("");
    setData(null);
    void load("");
  }, [open, service, stage, load]);

  useEffect(() => {
    if (!open || !auto) return;
    const t = setInterval(() => void load(applied), AUTO_REFRESH_MS);
    return () => clearInterval(t);
  }, [open, auto, applied, load]);

  const submitFilter = () => {
    setApplied(filter);
    void load(filter);
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent>
        <div className="flex h-[52px] shrink-0 items-center gap-2 border-b border-border px-4 pr-12">
          <SheetTitle className="flex items-center gap-2 text-[14px] font-semibold">
            <span className="mono">{service}</span>
            <Badge tone={stage === "prod" ? "red" : stage === "staging" ? "amber" : "blue"}>
              {stage}
            </Badge>
          </SheetTitle>
          <span className="text-[11.5px] text-muted-foreground">
            last 10 minutes · CloudWatch Logs
          </span>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-secondary/50 px-4 py-2">
          <div className="relative w-[320px]">
            <Filter className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-[26px] pl-7 pr-7 text-[11.5px]"
              placeholder="Filter — substring or CloudWatch pattern"
              value={filter}
              onChange={(e) => setFilter(e.currentTarget.value)}
              onKeyDown={(e) => e.key === "Enter" && submitFilter()}
            />
            {filter && (
              <button
                onClick={() => {
                  setFilter("");
                  setApplied("");
                  void load("");
                }}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <Button size="sm" onClick={submitFilter}>
            <Search className="h-3 w-3" />
            Apply
          </Button>
          <Button size="icon-sm" onClick={() => void load(applied)} title="Refresh">
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </Button>
          <label className="flex cursor-pointer items-center gap-1.5 text-[11.5px] text-muted-foreground">
            <Switch checked={auto} onCheckedChange={setAuto} />
            auto 10s
          </label>

          <div className="flex-1" />
          {data && (
            <span className="mono text-[11px] text-muted-foreground">
              {data.events.length} events{data.truncated ? " (capped at 2000)" : ""} ·{" "}
              {data.groups.length} log groups
            </span>
          )}
        </div>

        <div className="flex min-h-0 flex-1">
          <div className="min-w-0 flex-1 overflow-auto py-1.5">
            {error && (
              <div className="p-4">
                <Callout tone="danger" title="Could not read logs">
                  {error}
                </Callout>
              </div>
            )}
            {!error && loading && !data && <CenteredSpinner label="Reading CloudWatch…" />}
            {!error && data && data.events.length === 0 && (
              <div className="px-6 py-16 text-center">
                <div className="text-[13px] font-semibold">No events in the last 10 minutes</div>
                <p className="mx-auto mt-1 max-w-[420px] text-[11.5px] leading-relaxed text-muted-foreground">
                  {applied
                    ? `Nothing matched “${applied}” across ${data.groups.length} log groups.`
                    : "This service was idle in the window. Use the console links for anything older."}
                </p>
              </div>
            )}
            {!error &&
              data?.events.map((ev, i) => (
                <div
                  key={`${ev.ts}-${i}`}
                  className={cn(
                    "mono grid grid-cols-[88px_180px_1fr] gap-2.5 whitespace-pre-wrap break-words border-l-2 px-4 py-[1px] text-[11.5px] leading-[1.55] hover:bg-secondary/60",
                    LEVEL_STYLE[ev.level] ?? "border-l-transparent",
                  )}
                >
                  <span className="text-muted-foreground/70">{logTime(ev.ts)}</span>
                  <span className="truncate text-primary/80" title={ev.functionName}>
                    {shortFn(ev.functionName, service!, stage!)}
                  </span>
                  <span>{ev.message}</span>
                </div>
              ))}
          </div>

          <aside className="w-[290px] shrink-0 overflow-auto border-l border-border bg-secondary/40">
            <div className="eyebrow sticky top-0 border-b border-border bg-[#EEF2F7] px-3 py-2 text-muted-foreground">
              Log groups · discovered from stack
            </div>
            {data && (
              <div className="p-2">
                <Button variant="primary" size="sm" className="mb-2 w-full" asChild>
                  <a href={data.insightsUrl} target="_blank" rel="noreferrer">
                    <Search className="h-3 w-3" />
                    Open in Logs Insights (1h)
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
                {data.groups.map((g) => (
                  <a
                    key={g.logGroup}
                    href={g.consoleUrl}
                    target="_blank"
                    rel="noreferrer"
                    title={g.logGroup}
                    className="mono group/lg flex items-center gap-2 rounded px-1.5 py-[3px] text-[11px] text-muted-foreground no-underline hover:bg-white"
                  >
                    <span
                      className={cn(
                        "w-[26px] shrink-0 text-right tabular-nums",
                        g.eventCount ? "font-semibold text-status-green-fg" : "text-muted-foreground/40",
                      )}
                    >
                      {g.eventCount || "·"}
                    </span>
                    <span className="truncate group-hover/lg:text-primary">
                      {shortFn(g.functionName, service!, stage!)}
                    </span>
                    <ExternalLink className="ml-auto h-3 w-3 shrink-0 opacity-0 group-hover/lg:opacity-60" />
                  </a>
                ))}
              </div>
            )}
          </aside>
        </div>

        <div className="shrink-0 border-t border-border bg-secondary/50 px-4 py-1.5 text-[10.5px] text-muted-foreground">
          Control Tower stores nothing. Anything older than 10 minutes lives in the console.
          {lastAt && <span className="mono"> · refreshed {new Date(lastAt).toLocaleTimeString()}</span>}
        </div>
      </SheetContent>
    </Sheet>
  );
}
