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

import { parseAccessList, type AccessList } from "./auth/access.js";

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

export const IS_PRODUCTION = process.env.NODE_ENV === "production";

/* ---- auth ---------------------------------------------------------- */

export const SESSION_SECRET = process.env.TOWER_SESSION_SECRET ?? "";

export const GOOGLE = {
  clientId: process.env.GOOGLE_CLIENT_ID ?? "",
  clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  redirectUri: process.env.GOOGLE_REDIRECT_URI ?? "http://localhost:5273/api/auth/callback",
};

export const AUTH_CONFIGURED = Boolean(
  GOOGLE.clientId && GOOGLE.clientSecret && SESSION_SECRET,
);

/**
 * Signs in as a fixed email without Google, so the authorization layer can be
 * exercised before OAuth credentials exist. Refuses to work in production.
 */
export const DEV_LOGIN_EMAIL = IS_PRODUCTION ? "" : (process.env.TOWER_DEV_LOGIN_EMAIL ?? "");

/** Read fresh on every request, so merging a PR revokes access immediately. */
export function loadAccessList(): AccessList {
  const path = resolve(here, "../access.json");
  return parseAccessList(JSON.parse(readFileSync(path, "utf8")));
}

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
