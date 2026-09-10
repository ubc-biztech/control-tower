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
  /** Mock-only. The live path discovers functions from stack resources. */
  functions?: string[];
}

export interface UnmanagedStack {
  stackName: string;
  stage: Stage;
  cfnStatus: string;
  lastUpdated: string;
}

export interface MatrixResponse {
  deployables: Deployable[];
  cells: Record<string, StackState>; // key: `${service}|${stage}`
  /** Stacks deployed in the account that no deployable claims (R1.2). */
  unmanaged: UnmanagedStack[];
  fetchedAt: string;
  /** True when AWS was unreachable and this is last-known state (R1.7). */
  stale: boolean;
  /** True while no deployment anywhere carries git metadata yet (R1.3). */
  awaitingStackTags: boolean;
}

export type Role = "viewer" | "deployer" | "admin";

export interface SessionUser {
  email: string;
  name?: string;
  picture?: string;
  role: Role;
  /** Signed in through the local dev bypass rather than Google. */
  dev: boolean;
}

export interface AuthState {
  authenticated: boolean;
  /** False when GOOGLE_CLIENT_ID / TOWER_SESSION_SECRET are unset. */
  authConfigured: boolean;
  devLogin: boolean;
  domain: string;
  defaultRole: Role;
  user: SessionUser | null;
  /** The API could not be reached at all. */
  unreachable?: boolean;
}

/** What the server will and will not do, read once at startup. */
export interface Health {
  ok: boolean;
  account?: string;
  arn?: string;
  region?: string;
  readOnly?: boolean;
  writesEnabled: boolean;
  authConfigured?: boolean;
  devLogin?: boolean;
  authenticated?: boolean;
  role?: Role;
  email?: string;
  reason?: string;
  source: "live" | "mock";
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
  actor: string | null;
  reason?: string;
  status: "succeeded" | "failed" | "in-progress";
  /** serverless-state.json beside the artifact; carries this deploy's stack
   *  tags once the pipeline stamps them. */
  stateKey?: string | null;
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
  /** The log group does not exist: the function has never been invoked. */
  missing?: boolean;
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
