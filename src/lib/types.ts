/** Shared types. These mirror what the real v0 server routes will return,
 *  so swapping src/lib/api.ts from mock -> fetch is the only change needed. */

export type Stage = "dev" | "staging" | "prod";
export const STAGES: Stage[] = ["dev", "staging", "prod"];

/** Stack tags stamped by the deploy pipeline (git:sha, git:message, ...).
 *  Absent on any deploy made before stamping existed. */
export interface GitMeta {
  sha: string;
  message: string;
  ref: string;
  runUrl: string;
  runNumber: number;
  actor: string;
}

export type CellStatus =
  | "current" // matches the newest known good deploy for this service
  | "behind" // an older artifact than another stage has
  | "failed" // CFN reports a failed / rolled-back update
  | "rolling-back" // a Tower-triggered rollback is in flight
  | "unknown" // stack exists, Tower can't reconcile it
  | "absent"; // no stack for this service+stage

export interface StackState {
  service: string;
  stage: Stage;
  status: CellStatus;
  /** Raw CloudFormation stack status, e.g. UPDATE_COMPLETE. */
  cfnStatus: string | null;
  stackName: string;
  lastUpdated: string | null; // ISO
  git: GitMeta | null;
  /** How many deployments behind the leading stage, when status === "behind". */
  behindBy?: number;
  /** Which stage it is behind, for the drift note. */
  behindOf?: Stage;
  /** Set while a rollback run is in flight. */
  activeRunId?: string;
}

export interface Deployable {
  name: string;
  kind: "serverless";
  repo: string;
  path: string;
  stackPattern: string;
  stages: Stage[];
  functions: string[];
}

export interface MatrixResponse {
  deployables: Deployable[];
  cells: Record<string, StackState>; // key: `${service}|${stage}`
  fetchedAt: string;
  /** True when AWS was unreachable and this is last-known state (R1.7). */
  stale: boolean;
}

/** One entry from the stack's deployment bucket (`sls deploy list`). */
export interface Deployment {
  /** Serverless artifact timestamp, the value passed to `sls rollback --timestamp`. */
  timestamp: string;
  datetime: string; // ISO
  artifactKey: string;
  sizeBytes: number;
  current: boolean;
  /** Git metadata is only known for the CURRENT deploy (it lives in stack tags).
   *  Past artifacts in S3 carry no SHA — see docs/v0-notes.md. */
  git: GitMeta | null;
  kind: "deploy" | "rollback";
  actor: string;
  reason?: string;
  status: "succeeded" | "failed" | "in-progress";
}

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
}

export interface LogsResponse {
  events: LogEvent[];
  groups: LogGroupRef[];
  insightsUrl: string;
  windowMinutes: number;
  truncated: boolean;
}

export interface RollbackRun {
  runId: string;
  service: string;
  stage: Stage;
  timestamp: string;
  reason?: string;
  actor: string;
  status: "queued" | "in_progress" | "completed";
  conclusion: "success" | "failure" | null;
  runUrl: string;
  startedAt: string;
  steps: { name: string; status: "pending" | "running" | "done" | "failed" }[];
}

export const cellKey = (service: string, stage: Stage) => `${service}|${stage}`;
