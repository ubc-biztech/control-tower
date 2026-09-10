import { useCallback, useEffect, useRef, useState } from "react";
import {
  AnchorButton,
  Button,
  Callout,
  Drawer,
  InputGroup,
  NonIdealState,
  Spinner,
  Switch,
  Tag,
} from "@blueprintjs/core";
import { getLogs } from "@/lib/api";
import type { LogsResponse, Stage } from "@/lib/types";
import { logTime, shortFn } from "@/lib/format";

const AUTO_REFRESH_MS = 10_000;

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

  // Reset and load whenever the drawer target changes.
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
    <Drawer
      isOpen={open}
      onClose={onClose}
      size="72%"
      hasBackdrop
      title={
        <span className="flex items-center gap-2">
          <span className="mono text-[13px]">{service}</span>
          <Tag minimal intent={stage === "prod" ? "danger" : stage === "staging" ? "warning" : "primary"}>
            {stage}
          </Tag>
          <span className="text-[11px] font-normal" style={{ color: "var(--tower-dimmer)" }}>
            last 10 minutes · CloudWatch
          </span>
        </span>
      }
    >
      <div className="flex h-full min-h-0 flex-col">
        {/* Toolbar */}
        <div
          className="flex shrink-0 items-center gap-2 border-b px-3 py-2"
          style={{ borderColor: "var(--tower-edge)", background: "var(--tower-panel)" }}
        >
          <InputGroup
            small
            className="w-[340px]"
            leftIcon="filter"
            placeholder="Filter — substring or CloudWatch pattern"
            value={filter}
            onChange={(e) => setFilter(e.currentTarget.value)}
            onKeyDown={(e) => e.key === "Enter" && submitFilter()}
            rightElement={
              filter ? (
                <Button
                  minimal
                  small
                  icon="cross"
                  onClick={() => {
                    setFilter("");
                    setApplied("");
                    void load("");
                  }}
                />
              ) : undefined
            }
          />
          <Button small icon="search" onClick={submitFilter}>
            Apply
          </Button>
          <Button small icon="refresh" loading={loading} onClick={() => void load(applied)} />
          <Switch
            className="!mb-0 !text-[11px]"
            checked={auto}
            label="auto 10s"
            onChange={(e) => setAuto(e.currentTarget.checked)}
          />
          <div className="flex-1" />
          {data && (
            <span className="mono text-[11px]" style={{ color: "var(--tower-dimmer)" }}>
              {data.events.length} events
              {data.truncated ? " (capped at 2000)" : ""} · {data.groups.length} log groups
            </span>
          )}
        </div>

        <div className="flex min-h-0 flex-1">
          {/* Stream */}
          <div className="min-w-0 flex-1 overflow-auto py-2">
            {error && (
              <div className="p-3">
                <Callout intent="danger" icon="error" title="Could not read logs">
                  {error}
                </Callout>
              </div>
            )}
            {!error && loading && !data && (
              <div className="pt-16">
                <Spinner size={22} />
              </div>
            )}
            {!error && data && data.events.length === 0 && (
              <NonIdealState
                icon="feed"
                title="No events in the last 10 minutes"
                description={
                  applied
                    ? `Nothing matched "${applied}" across ${data.groups.length} log groups.`
                    : "This service was idle in the window. Use the console links for anything older."
                }
              />
            )}
            {!error &&
              data?.events.map((ev, i) => (
                <div key={`${ev.ts}-${i}`} className={`log-line mono lvl-${ev.level}`}>
                  <span style={{ color: "var(--tower-dimmer)" }}>{logTime(ev.ts)}</span>
                  <span
                    className="truncate"
                    title={ev.functionName}
                    style={{ color: "#7282a8" }}
                  >
                    {shortFn(ev.functionName, service!, stage!)}
                  </span>
                  <span
                    style={{
                      color:
                        ev.level === "ERROR"
                          ? "#ff8a9e"
                          : ev.level === "WARN"
                            ? "#f0b357"
                            : undefined,
                    }}
                  >
                    {ev.message}
                  </span>
                </div>
              ))}
          </div>

          {/* Log group rail */}
          <div
            className="w-[302px] shrink-0 overflow-auto border-l"
            style={{ borderColor: "var(--tower-edge)", background: "var(--tower-panel)" }}
          >
            <div
              className="sticky top-0 border-b px-3 py-2 text-[10px] font-bold tracking-[0.09em]"
              style={{
                borderColor: "var(--tower-edge)",
                background: "var(--tower-raised)",
                color: "var(--tower-dim)",
              }}
            >
              LOG GROUPS · DISCOVERED FROM STACK
            </div>
            {data && (
              <div className="p-2">
                <AnchorButton
                  small
                  fill
                  icon="search-template"
                  rightIcon="share"
                  href={data.insightsUrl}
                  target="_blank"
                  intent="primary"
                  className="!mb-2"
                >
                  Open in Logs Insights (1h)
                </AnchorButton>
                {data.groups.map((g) => (
                  <a
                    key={g.logGroup}
                    href={g.consoleUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mono flex items-center gap-2 px-1.5 py-[3px] text-[11px] no-underline hover:bg-white/5"
                    style={{ color: "var(--tower-dim)" }}
                    title={g.logGroup}
                  >
                    <span className="w-[26px] shrink-0 text-right" style={{ color: g.eventCount ? "#70e442" : "var(--tower-dimmer)" }}>
                      {g.eventCount || "·"}
                    </span>
                    <span className="truncate">{shortFn(g.functionName, service!, stage!)}</span>
                    <span className="bp5-icon bp5-icon-share ml-auto shrink-0 opacity-40" />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        <div
          className="shrink-0 border-t px-3 py-1.5 text-[10.5px]"
          style={{ borderColor: "var(--tower-edge)", color: "var(--tower-dimmer)" }}
        >
          Tower stores nothing. Anything older than 10 minutes lives in the console.
          {lastAt && <span className="mono"> · refreshed {new Date(lastAt).toLocaleTimeString()}</span>}
        </div>
      </div>
    </Drawer>
  );
}
