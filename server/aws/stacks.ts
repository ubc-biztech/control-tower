import { DescribeStacksCommand, type Stack } from "@aws-sdk/client-cloudformation";
import { cloudFormation } from "./clients.js";
import { CACHE_TTL_MS, STAGES, loadDeployables, stackNameFor, type Stage } from "../config.js";
import { cached } from "../cache.js";

/** Stack tags the deploy pipeline will stamp. None of these exist yet. */
const TAG_KEYS = {
  sha: ["git:sha", "git_sha", "GIT_SHA"],
  message: ["git:message", "git_message", "GIT_MESSAGE"],
  ref: ["git:ref", "git_ref", "GIT_REF"],
  runUrl: ["ci:run_url", "ci_run_url", "CI_RUN_URL"],
  actor: ["ci:actor", "ci_actor", "CI_ACTOR"],
} as const;

function tag(stack: Stack, keys: readonly string[]): string | null {
  for (const k of keys) {
    const hit = stack.Tags?.find((t) => t.Key === k);
    if (hit?.Value && hit.Value !== "unknown") return hit.Value;
  }
  return null;
}

export interface StackFacts {
  stackName: string;
  cfnStatus: string;
  lastUpdated: string;
  tags: Record<string, string>;
  git: {
    sha: string;
    message: string;
    ref: string | null;
    runUrl: string | null;
    actor: string | null;
  } | null;
}

/**
 * One DescribeStacks pass returns every stack in the account with its tags and
 * timestamps, so the whole matrix costs two API calls rather than sixty.
 */
async function describeAll(): Promise<Map<string, StackFacts>> {
  const out = new Map<string, StackFacts>();
  let token: string | undefined;
  do {
    const res = await cloudFormation.send(new DescribeStacksCommand({ NextToken: token }));
    for (const s of res.Stacks ?? []) {
      if (!s.StackName) continue;
      // DELETE_COMPLETE stacks still come back on a named lookup; skip them.
      if (s.StackStatus?.startsWith("DELETE_")) continue;
      const sha = tag(s, TAG_KEYS.sha);
      out.set(s.StackName, {
        stackName: s.StackName,
        cfnStatus: s.StackStatus ?? "UNKNOWN",
        lastUpdated: (s.LastUpdatedTime ?? s.CreationTime ?? new Date()).toISOString(),
        tags: Object.fromEntries((s.Tags ?? []).map((t) => [t.Key!, t.Value!])),
        git: sha
          ? {
              sha,
              message: tag(s, TAG_KEYS.message) ?? "",
              ref: tag(s, TAG_KEYS.ref),
              runUrl: tag(s, TAG_KEYS.runUrl),
              actor: tag(s, TAG_KEYS.actor),
            }
          : null,
      });
    }
    token = res.NextToken;
  } while (token);
  return out;
}

export type CellStatus = "current" | "behind" | "failed" | "unknown" | "absent";

export interface Cell {
  service: string;
  stage: Stage;
  stackName: string;
  status: CellStatus;
  cfnStatus: string | null;
  lastUpdated: string | null;
  git: StackFacts["git"];
}

export interface MatrixPayload {
  deployables: ReturnType<typeof loadDeployables>;
  cells: Record<string, Cell>;
  /** Stacks in the account matching a {name}-{stage} shape that Tower does not
   *  know about. AWS is the source of truth, so these are surfaced, not hidden. */
  unmanaged: { stackName: string; stage: Stage; cfnStatus: string; lastUpdated: string }[];
  fetchedAt: string;
  stale: boolean;
  /** True when no deploy anywhere carries git metadata yet (R1.3). */
  awaitingStackTags: boolean;
}

/** CloudFormation statuses that mean the last operation did not succeed. */
const FAILED = /(ROLLBACK_COMPLETE|ROLLBACK_FAILED|_FAILED)$/;
const IN_PROGRESS = /_IN_PROGRESS$/;

export async function getMatrix(): Promise<MatrixPayload> {
  const deployables = loadDeployables();
  const stacks = await cached("stacks", CACHE_TTL_MS, describeAll);

  const cells: Record<string, Cell> = {};
  const claimed = new Set<string>();
  let anyGit = false;

  for (const d of deployables) {
    for (const stage of STAGES) {
      const stackName = stackNameFor(d, stage);
      claimed.add(stackName);
      const facts = stacks.get(stackName);
      const key = `${d.name}|${stage}`;

      if (!facts) {
        cells[key] = {
          service: d.name,
          stage,
          stackName,
          status: "absent",
          cfnStatus: null,
          lastUpdated: null,
          git: null,
        };
        continue;
      }

      if (facts.git) anyGit = true;
      cells[key] = {
        service: d.name,
        stage,
        stackName,
        status: FAILED.test(facts.cfnStatus)
          ? "failed"
          : IN_PROGRESS.test(facts.cfnStatus)
            ? "unknown"
            : "current",
        cfnStatus: facts.cfnStatus,
        lastUpdated: facts.lastUpdated,
        git: facts.git,
      };
    }
  }

  const unmanaged: MatrixPayload["unmanaged"] = [];
  for (const [name, facts] of stacks) {
    if (claimed.has(name)) continue;
    const m = name.match(/^(.+)-(dev|staging|prod)$/);
    if (!m) continue; // not a service stack at all (CDKToolkit, amplify-*, …)
    unmanaged.push({
      stackName: name,
      stage: m[2] as Stage,
      cfnStatus: facts.cfnStatus,
      lastUpdated: facts.lastUpdated,
    });
  }
  unmanaged.sort((a, b) => a.stackName.localeCompare(b.stackName));

  return {
    deployables,
    cells,
    unmanaged,
    fetchedAt: new Date().toISOString(),
    stale: false,
    awaitingStackTags: !anyGit,
  };
}
