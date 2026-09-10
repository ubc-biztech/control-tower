import { FilterLogEventsCommand } from "@aws-sdk/client-cloudwatch-logs";
import { cloudWatchLogs } from "./clients.js";
import { getStackResources } from "./resources.js";
import { REGION } from "../config.js";

const MAX_EVENTS = 2000;
const PER_GROUP_LIMIT = 300;
const CONCURRENCY = 8;

export interface LogEvent {
  ts: number;
  functionName: string;
  message: string;
  level: "INFO" | "WARN" | "ERROR" | "START" | "END" | "REPORT";
}

export interface LogGroupRef {
  functionName: string;
  logGroup: string;
  consoleUrl: string;
  eventCount: number;
  /** True when the log group has never been created (function never invoked). */
  missing: boolean;
}

/** The console double-encodes `%` in the log-group path. */
export function logGroupConsoleUrl(logGroup: string) {
  const enc = encodeURIComponent(logGroup).replace(/%/g, "$25");
  return `https://${REGION}.console.aws.amazon.com/cloudwatch/home?region=${REGION}#logsV2:log-groups/log-group/${enc}`;
}

export function insightsUrl(logGroups: string[]) {
  const query = "fields @timestamp, @message\n| sort @timestamp desc\n| limit 200";
  const esc = (s: string) =>
    encodeURIComponent(s).replace(/[!'()*~]/g, (c) => "*" + c.charCodeAt(0).toString(16));
  const sources = logGroups.map((g) => `~'${esc(g)}`).join("");
  const detail =
    `~(end~0~start~-3600~timeType~'RELATIVE~unit~'seconds` +
    `~editorString~'${esc(query)}~source~(${sources}))`;
  return `https://${REGION}.console.aws.amazon.com/cloudwatch/home?region=${REGION}#logsV2:logs-insights?queryDetail=${detail}`;
}

function levelOf(message: string): LogEvent["level"] {
  if (message.startsWith("START ")) return "START";
  if (message.startsWith("END ")) return "END";
  if (message.startsWith("REPORT ")) return "REPORT";
  if (/\b(ERROR|Error:|Exception|\[error\])\b/.test(message)) return "ERROR";
  if (/\b(WARN|Warning|\[warn\])\b/.test(message)) return "WARN";
  return "INFO";
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const i = cursor++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

/**
 * The last `minutes` of every Lambda in the stack, merged. Log groups are
 * discovered from stack resources, so new functions appear without config.
 * Nothing is written or stored — Tower has no log store (R3.5).
 */
export async function recentLogs(
  stackName: string,
  opts: { minutes?: number; filter?: string } = {},
) {
  const minutes = opts.minutes ?? 10;
  const startTime = Date.now() - minutes * 60_000;
  const { lambdaFunctionNames } = await getStackResources(stackName);

  const results = await mapLimit(lambdaFunctionNames, CONCURRENCY, async (functionName) => {
    const logGroup = `/aws/lambda/${functionName}`;
    try {
      const res = await cloudWatchLogs.send(
        new FilterLogEventsCommand({
          logGroupName: logGroup,
          startTime,
          limit: PER_GROUP_LIMIT,
          ...(opts.filter ? { filterPattern: toFilterPattern(opts.filter) } : {}),
        }),
      );
      const events: LogEvent[] = (res.events ?? []).map((e) => {
        const message = (e.message ?? "").replace(/\s+$/, "");
        return { ts: e.timestamp ?? startTime, functionName, message, level: levelOf(message) };
      });
      return { functionName, logGroup, events, missing: false };
    } catch (err) {
      const name = (err as { name?: string }).name;
      // A function that has never run has no log group. That is not an error.
      if (name === "ResourceNotFoundException")
        return { functionName, logGroup, events: [] as LogEvent[], missing: true };
      throw err;
    }
  });

  const merged = results.flatMap((r) => r.events).sort((a, b) => b.ts - a.ts);

  const groups: LogGroupRef[] = results
    .map((r) => ({
      functionName: r.functionName,
      logGroup: r.logGroup,
      consoleUrl: logGroupConsoleUrl(r.logGroup),
      eventCount: r.events.length,
      missing: r.missing,
    }))
    .sort((a, b) => b.eventCount - a.eventCount || a.functionName.localeCompare(b.functionName));

  return {
    events: merged.slice(0, MAX_EVENTS),
    groups,
    insightsUrl: insightsUrl(results.map((r) => r.logGroup)),
    windowMinutes: minutes,
    truncated: merged.length > MAX_EVENTS,
  };
}

/**
 * CloudWatch filter patterns are their own syntax; a bare word is a valid
 * pattern but anything with spaces or punctuation is not. Quote it unless the
 * caller clearly wrote a real pattern.
 */
function toFilterPattern(input: string): string {
  const s = input.trim();
  if (/^[{?[]/.test(s) || /^".*"$/.test(s)) return s;
  return `"${s.replace(/"/g, '\\"')}"`;
}
