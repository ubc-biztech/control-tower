import type { LogEvent, LogGroupRef, LogsResponse, Stage } from "@/lib/types";
import { HTTP_METHODS, LOG_TEMPLATES } from "./corpus";
import { hashString, mulberry32, pick } from "./rng";
import { AWS_REGION, DEPLOYABLES } from "./world";

const MAX_EVENTS = 2000;

/** The console's log-group URL escapes `%` a second time. */
export function logGroupConsoleUrl(logGroup: string) {
  const enc = encodeURIComponent(logGroup).replace(/%/g, "$25");
  return `https://${AWS_REGION}.console.aws.amazon.com/cloudwatch/home?region=${AWS_REGION}#logsV2:log-groups/log-group/${enc}`;
}

export function insightsUrl(logGroups: string[]) {
  const query = "fields @timestamp, @message | sort @timestamp desc | limit 200";
  // The Insights console double-encodes its fragment payload.
  const enc = (s: string) => encodeURIComponent(s).replace(/%/g, "*").replace(/\*/g, "*");
  const sources = logGroups.map((g) => `~'${g}`).join("");
  const payload = `~(end~'0~start~'-3600~timeType~'RELATIVE~unit~'seconds~editorString~'${enc(
    query,
  )}~source~(${sources}))`;
  return `https://${AWS_REGION}.console.aws.amazon.com/cloudwatch/home?region=${AWS_REGION}#logsV2:logs-insights?queryDetail=${payload}`;
}

export function functionsFor(service: string, stage: Stage) {
  const d = DEPLOYABLES.find((x) => x.name === service);
  if (!d) return [];
  return d.functions.map((fn) => {
    const functionName = `${service}-${stage}-${fn}`;
    return { key: fn, functionName, logGroup: `/aws/lambda/${functionName}` };
  });
}

function render(tpl: string, rand: () => number, stage: Stage) {
  return tpl
    .replace("{method}", pick(rand, HTTP_METHODS))
    .replace("{path}", pick(rand, ["/events", "/users/me", "/registrations", "/qr/scan", "/teams"]))
    .replace("{rid}", Math.random().toString(36).slice(2, 12))
    .replace("{stage}", stage === "prod" ? "" : stage.charAt(0).toUpperCase() + stage.slice(1))
    .replace("{n}", String(1 + Math.floor(rand() * 40)))
    .replace("{a}", String(1 + Math.floor(rand() * 3)))
    .replace("{ms}", String(3 + Math.floor(rand() * 900)))
    .replace("{bytes}", String(180 + Math.floor(rand() * 9000)))
    .replace("{sub}", Math.random().toString(36).slice(2, 10))
    .replace("{email}", pick(rand, ["exec@ubcbiztech.com", "member@student.ubc.ca", "partner@corp.com"]));
}

/**
 * Simulates FilterLogEvents across every function in the stack for the
 * trailing `minutes` window. prod is busy, dev is quiet, staging is near-dead.
 */
export function recentLogs(
  service: string,
  stage: Stage,
  opts: { minutes?: number; filter?: string } = {},
): LogsResponse {
  const minutes = opts.minutes ?? 10;
  const now = Date.now();
  const windowStart = now - minutes * 60_000;
  const fns = functionsFor(service, stage);

  const trafficFactor = stage === "prod" ? 1 : stage === "dev" ? 0.28 : 0.05;
  const events: LogEvent[] = [];
  const counts = new Map<string, number>();

  for (const fn of fns) {
    const rand = mulberry32(hashString(fn.functionName + Math.floor(now / 10_000)));
    // Most functions are idle in any 10-minute window; a few are hot.
    const hot = rand() < 0.35 * (trafficFactor + 0.2);
    const invocations = hot
      ? Math.floor(rand() * 18 * trafficFactor) + 2
      : rand() < 0.4 * trafficFactor
        ? 1
        : 0;

    for (let i = 0; i < invocations; i++) {
      const at = windowStart + Math.floor(rand() * minutes * 60_000);
      const rid = Math.random().toString(36).slice(2, 12) + "-" + Math.random().toString(36).slice(2, 6);
      const durMs = 5 + Math.floor(rand() * 1400);

      events.push({ ts: at, functionName: fn.functionName, level: "START", message: `START RequestId: ${rid} Version: $LATEST` });

      const lines = 1 + Math.floor(rand() * 4);
      for (let l = 0; l < lines; l++) {
        const tpl = pick(rand, LOG_TEMPLATES);
        // Errors are rare outside the known-bad service.
        if (tpl.level === "ERROR" && rand() > (service === "biztechApi-payments" ? 0.5 : 0.12)) continue;
        events.push({
          ts: at + 1 + Math.floor(rand() * durMs),
          functionName: fn.functionName,
          level: tpl.level,
          message: render(tpl.t, rand, stage),
        });
      }

      events.push({ ts: at + durMs, functionName: fn.functionName, level: "END", message: `END RequestId: ${rid}` });
      events.push({
        ts: at + durMs + 1,
        functionName: fn.functionName,
        level: "REPORT",
        message: `REPORT RequestId: ${rid}\tDuration: ${durMs}.${Math.floor(rand() * 90)} ms\tBilled Duration: ${
          durMs + 1
        } ms\tMemory Size: 1024 MB\tMax Memory Used: ${68 + Math.floor(rand() * 180)} MB`,
      });
    }
    counts.set(fn.functionName, invocations);
  }

  let filtered = events;
  const f = opts.filter?.trim();
  if (f) {
    const needle = f.toLowerCase();
    filtered = events.filter(
      (e) => e.message.toLowerCase().includes(needle) || e.functionName.toLowerCase().includes(needle),
    );
  }

  filtered.sort((a, b) => b.ts - a.ts);
  const truncated = filtered.length > MAX_EVENTS;

  const groups: LogGroupRef[] = fns
    .map((fn) => ({
      functionName: fn.functionName,
      logGroup: fn.logGroup,
      consoleUrl: logGroupConsoleUrl(fn.logGroup),
      eventCount: filtered.filter((e) => e.functionName === fn.functionName).length,
    }))
    .sort((a, b) => b.eventCount - a.eventCount);

  return {
    events: filtered.slice(0, MAX_EVENTS),
    groups,
    insightsUrl: insightsUrl(fns.map((x) => x.logGroup)),
    windowMinutes: minutes,
    truncated,
  };
}
