import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Load .env into process.env for the server only. Vite exposes VITE_-prefixed
 * variables to the browser; AWS credentials deliberately have no such prefix,
 * so they exist in Node and nowhere else.
 */
function loadDotEnv() {
  try {
    const text = readFileSync(resolve(here, "../.env"), "utf8");
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!m) continue;
      const value = m[2].trim().replace(/^["'](.*)["']$/, "$1");
      if (process.env[m[1]] === undefined) process.env[m[1]] = value;
    }
  } catch {
    /* no .env — environment variables are expected to be set another way */
  }
}
loadDotEnv();

export interface Deployable {
  name: string;
  kind: "serverless";
  repo: string;
  path: string;
  stackPattern: string;
  stages: Stage[];
}

export type Stage = "dev" | "staging" | "prod";
export const STAGES: Stage[] = ["dev", "staging", "prod"];

export const REGION = process.env.AWS_REGION || "us-west-2";

/**
 * Writes are off by default and there is no code path that performs one.
 * Turning this on only changes the error the rollback route returns; the
 * dispatch itself is still unimplemented. See docs/read-only.md.
 */
export const ALLOW_ROLLBACK = process.env.TOWER_ALLOW_ROLLBACK === "true";

export const CACHE_TTL_MS = Number(process.env.TOWER_CACHE_TTL_MS ?? 30_000);

export function loadDeployables(): Deployable[] {
  const path = resolve(here, "../src/data/deployables.json");
  const raw = JSON.parse(readFileSync(path, "utf8")) as (Deployable & { functions?: string[] })[];
  // `functions` in that file exists only so the mock knows what to invent.
  // The live path discovers functions from the stack's resources.
  return raw.map(({ functions: _ignored, ...d }) => d);
}

export function stackNameFor(d: Deployable, stage: Stage) {
  return d.stackPattern.replace("{stage}", stage);
}
