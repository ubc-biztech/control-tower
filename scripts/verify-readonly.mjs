#!/usr/bin/env node
/**
 * Fails if anything under server/ could mutate AWS.
 *
 * Control Tower's read-only guarantee is meant to be structural, not a
 * convention. This checks two things:
 *   1. every AWS SDK command imported by the server is on the allowlist
 *   2. no AWS SDK client is imported by anything the browser bundle can reach
 *
 * Run by `npm run build` and `npm test`.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;

/** The complete set of AWS operations this application is permitted to call. */
const ALLOWED_COMMANDS = new Set([
  "DescribeStacksCommand",
  "ListStackResourcesCommand",
  "ListStacksCommand",
  "ListObjectsV2Command",
  "GetObjectCommand",
  "FilterLogEventsCommand",
  "GetLogEventsCommand",
  "DescribeLogGroupsCommand",
  "GetCallerIdentityCommand",
]);

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist" || entry.startsWith(".")) continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx|mjs|js)$/.test(p)) out.push(p);
  }
  return out;
}

const failures = [];

/* 1 — every @aws-sdk import in server/ must be on the allowlist. */
const IMPORT_RE = /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+["']@aws-sdk\/([^"']+)["']/g;
for (const file of walk(join(ROOT, "server"))) {
  const src = readFileSync(file, "utf8");
  for (const m of src.matchAll(IMPORT_RE)) {
    for (const raw of m[1].split(",")) {
      const name = raw.replace(/\btype\b/, "").split(" as ")[0].trim();
      if (!name || !name.endsWith("Command")) continue; // clients and types are fine
      if (!ALLOWED_COMMANDS.has(name)) {
        failures.push(
          `${relative(ROOT, file)}: imports ${name} from @aws-sdk/${m[2]}, which is not on the read-only allowlist`,
        );
      }
    }
  }
}

/* 2 — nothing the browser bundle can reach may import the AWS SDK. */
for (const file of walk(join(ROOT, "src"))) {
  const src = readFileSync(file, "utf8");
  if (/from\s+["']@aws-sdk\//.test(src) || /require\(["']@aws-sdk\//.test(src)) {
    failures.push(`${relative(ROOT, file)}: client code must never import the AWS SDK`);
  }
  if (/AWS_SECRET_ACCESS_KEY|AWS_ACCESS_KEY_ID/.test(src)) {
    failures.push(`${relative(ROOT, file)}: client code must never reference AWS credentials`);
  }
}

if (failures.length) {
  console.error("\n  READ-ONLY CHECK FAILED\n");
  for (const f of failures) console.error("   x " + f);
  console.error("\n  See docs/read-only.md.\n");
  process.exit(1);
}

console.log(
  `read-only check passed — ${ALLOWED_COMMANDS.size} allowed AWS operations, no SDK reachable from the browser bundle`,
);
