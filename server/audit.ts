/**
 * Append-only record of anything that matters (R6.3).
 *
 * Structured lines on stdout, which is all a serverless host reliably keeps.
 * When rollback lands, "who rolled back what, when, and why" belongs here, and
 * stdout stops being good enough — that is the point to add a real store.
 */
export function audit(event: string, fields: Record<string, unknown> = {}) {
  const line = JSON.stringify({ at: new Date().toISOString(), event, ...fields });
  // eslint-disable-next-line no-console
  console.log(`[audit] ${line}`);
}
