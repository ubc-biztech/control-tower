import deployablesJson from "@/data/deployables.json";
import type {
  Deployable,
  Deployment,
  GitMeta,
  RollbackRun,
  Stage,
  StackState,
} from "@/lib/types";
import { STAGES, cellKey } from "@/lib/types";
import { ACTORS, BRANCHES, COMMIT_MESSAGES } from "./corpus";
import { hashString, mulberry32, pick, sha } from "./rng";

export const DEPLOYABLES = deployablesJson as Deployable[];
export const AWS_ACCOUNT = "432714361962";
export const AWS_REGION = "us-west-2";

/** Deploys made before stack tagging existed carry no git metadata (R1.3). */
type Scenario = "normal" | "absent" | "failed" | "unknown" | "no-git" | "behind";

const SCENARIOS: Record<string, Partial<Record<Stage, Scenario>>> = {
  "biztechApi-payments": { prod: "failed" },
  "biztechApi-qr": { dev: "no-git", prod: "no-git" },
  "biztechApi-stickers": { prod: "unknown" },
  "biztechApi-events": { staging: "normal" },
  "biztech-quizzes": { staging: "normal", prod: "behind" },
  "biztechApi-registrations": { prod: "behind" },
  "biztech-investments": { prod: "no-git" },
  "biztechApi-bots": { prod: "absent" },
  "biztechApi-btx": { staging: "normal", prod: "behind" },
  "biztechApi-interactions": { prod: "behind" },
};

function scenarioFor(service: string, stage: Stage): Scenario {
  const o = SCENARIOS[service]?.[stage];
  if (o) return o;
  return stage === "staging" ? "absent" : "normal";
}

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

function makeGit(rand: () => number, stage: Stage, runNumber: number): GitMeta {
  const full = sha(rand);
  return {
    sha: full,
    message: pick(rand, COMMIT_MESSAGES),
    ref: BRANCHES[stage],
    runNumber,
    runUrl: `https://github.com/ubc-biztech/serverless-biztechapp/actions/runs/${
      17000000000 + runNumber * 137
    }`,
    actor: pick(rand, ACTORS),
  };
}

/** `sls` artifact prefix: serverless/{service}/{stage}/{epochMs}-{iso} */
function artifactKey(service: string, stage: Stage, at: number) {
  const iso = new Date(at).toISOString();
  return `serverless/${service}/${stage}/${at}-${iso}/${service}.zip`;
}

export interface World {
  cells: Record<string, StackState>;
  deployments: Record<string, Deployment[]>;
  runs: Record<string, RollbackRun>;
  bootedAt: number;
}

function buildWorld(now: number): World {
  const cells: Record<string, StackState> = {};
  const deployments: Record<string, Deployment[]> = {};

  for (const d of DEPLOYABLES) {
    for (const stage of STAGES) {
      const key = cellKey(d.name, stage);
      const rand = mulberry32(hashString(key));
      const scenario = scenarioFor(d.name, stage);
      const stackName = d.stackPattern.replace("{stage}", stage);

      if (scenario === "absent") {
        cells[key] = {
          service: d.name,
          stage,
          status: "absent",
          cfnStatus: null,
          stackName,
          lastUpdated: null,
          git: null,
        };
        deployments[key] = [];
        continue;
      }

      // How long ago the current deploy landed.
      const ageMs =
        stage === "dev"
          ? Math.floor(rand() * 20 * HOUR) + 40 * MIN
          : Math.floor(rand() * 9 * DAY) + 2 * DAY;
      const lastAt = now - ageMs;

      // Serverless keeps the last 5 packages per stack.
      const history: Deployment[] = [];
      let cursor = lastAt;
      for (let i = 0; i < 5; i++) {
        const at = cursor;
        history.push({
          timestamp: String(at),
          datetime: new Date(at).toISOString(),
          artifactKey: artifactKey(d.name, stage, at),
          sizeBytes: 2_400_000 + Math.floor(rand() * 3_800_000),
          current: i === 0,
          git: null, // S3 artifacts carry no SHA — see docs/v0-notes.md
          kind: "deploy",
          actor: pick(rand, ACTORS),
          status: i === 0 && scenario === "failed" ? "failed" : "succeeded",
        });
        cursor -= Math.floor(rand() * 4 * DAY) + (stage === "dev" ? 3 * HOUR : 18 * HOUR);
      }
      deployments[key] = history;

      const runNumber = 380 + Math.floor(rand() * 60);
      const hasGit = scenario !== "no-git" && scenario !== "unknown";
      const git = hasGit ? makeGit(rand, stage, runNumber) : null;
      // The current artifact is the one the stack tags describe.
      history[0].git = git;

      const status: StackState["status"] =
        scenario === "failed"
          ? "failed"
          : scenario === "unknown"
            ? "unknown"
            : scenario === "behind"
              ? "behind"
              : "current";

      cells[key] = {
        service: d.name,
        stage,
        status,
        cfnStatus:
          scenario === "failed"
            ? "UPDATE_ROLLBACK_COMPLETE"
            : scenario === "unknown"
              ? "UPDATE_IN_PROGRESS"
              : "UPDATE_COMPLETE",
        stackName,
        lastUpdated: new Date(lastAt).toISOString(),
        git,
        ...(scenario === "behind"
          ? { behindBy: 1 + Math.floor(rand() * 3), behindOf: "dev" as Stage }
          : {}),
      };
    }
  }

  return { cells, deployments, runs: {}, bootedAt: now };
}

export const world: World = buildWorld(Date.now());

/* ------------------------------------------------------------------ */
/* Rollback simulation                                                 */
/* ------------------------------------------------------------------ */

const ROLLBACK_STEPS = [
  "Set up job",
  "Checkout serverless-biztechapp",
  "Setup Node 22",
  "npm ci --legacy-peer-deps",
  "sls rollback --timestamp",
  "Post summary",
];

export function startRollback(args: {
  service: string;
  stage: Stage;
  timestamp: string;
  reason?: string;
}): RollbackRun {
  const runId = `run_${Math.random().toString(36).slice(2, 10)}`;
  const run: RollbackRun = {
    runId,
    service: args.service,
    stage: args.stage,
    timestamp: args.timestamp,
    reason: args.reason,
    actor: "tower (mock)",
    status: "queued",
    conclusion: null,
    runUrl: `https://github.com/ubc-biztech/serverless-biztechapp/actions/runs/${Date.now()}`,
    startedAt: new Date().toISOString(),
    steps: ROLLBACK_STEPS.map((name) => ({ name, status: "pending" as const })),
  };
  world.runs[runId] = run;

  const key = cellKey(args.service, args.stage);
  if (world.cells[key]) {
    world.cells[key].status = "rolling-back";
    world.cells[key].activeRunId = runId;
  }

  // Advance the fake workflow one step at a time.
  let i = 0;
  const tick = () => {
    const r = world.runs[runId];
    if (!r) return;
    if (i > 0) r.steps[i - 1].status = "done";
    if (i < r.steps.length) {
      r.steps[i].status = "running";
      r.status = i === 0 ? "queued" : "in_progress";
      i++;
      setTimeout(tick, 1200 + Math.random() * 1400);
      return;
    }
    r.status = "completed";
    r.conclusion = "success";
    applyRollback(r);
  };
  setTimeout(tick, 700);

  return run;
}

function applyRollback(run: RollbackRun) {
  const key = cellKey(run.service, run.stage);
  const history = world.deployments[key];
  const cell = world.cells[key];
  if (!history || !cell) return;

  const target = history.find((d) => d.timestamp === run.timestamp);
  const previous = history.find((d) => d.current);
  if (!target || !previous) return;

  previous.current = false;

  // A rollback appears as its own row: who, when, from -> to (R2.5).
  const at = Date.now();
  history.unshift({
    timestamp: String(at),
    datetime: new Date(at).toISOString(),
    artifactKey: target.artifactKey,
    sizeBytes: target.sizeBytes,
    current: true,
    git: null,
    kind: "rollback",
    actor: run.actor,
    reason: run.reason || undefined,
    status: "succeeded",
  });

  cell.status = "current";
  cell.cfnStatus = "UPDATE_COMPLETE";
  cell.lastUpdated = new Date(at).toISOString();
  // The stack tags now describe the artifact we rolled TO, which has no
  // recorded SHA. Tower shows that honestly rather than guessing.
  cell.git = null;
  delete cell.activeRunId;
}

export function activeRunFor(service: string, stage: Stage): RollbackRun | null {
  const cell = world.cells[cellKey(service, stage)];
  if (!cell?.activeRunId) return null;
  return world.runs[cell.activeRunId] ?? null;
}
