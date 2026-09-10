export const shortSha = (s?: string | null) => (s ? s.slice(0, 7) : null);

export function firstLine(msg: string, max = 72) {
  const line = msg.split("\n")[0];
  return line.length > max ? line.slice(0, max - 1) + "…" : line;
}

export function relTime(iso: string | number | null | undefined): string {
  if (iso == null) return "—";
  const t = typeof iso === "number" ? iso : Date.parse(iso);
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 45) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d`;
  return `${Math.round(d / 30)}mo`;
}

export function absTime(iso: string | number | null | undefined): string {
  if (iso == null) return "—";
  const d = new Date(typeof iso === "number" ? iso : Date.parse(iso));
  return d.toISOString().replace("T", " ").slice(0, 19) + "Z";
}

/** HH:MM:SS.mmm — the density CloudWatch tailing wants. */
export function logTime(ts: number): string {
  const d = new Date(ts);
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
}

export function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 ** 2).toFixed(1)} MB`;
}

/** `biztechApi-payments-prod-paymentWebhook` -> `paymentWebhook`. */
export function shortFn(functionName: string, service: string, stage: string) {
  const prefix = `${service}-${stage}-`;
  return functionName.startsWith(prefix) ? functionName.slice(prefix.length) : functionName;
}
