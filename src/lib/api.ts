/**
 * Tower P0 data access.
 *
 * Every function here is shaped like the HTTP route it will become in v0
 * (GET /api/matrix, GET /api/deployments, GET /api/logs, POST /api/rollback,
 * GET /api/rollback/:runId). Today they resolve against the in-memory mock
 * world instead of AWS. Swapping to the real backend means replacing the
 * bodies with `fetch` — nothing else in the app touches the mock.
 *
 * NOTHING in this file performs a network call or holds a credential.
 */
import type {
  Deployment,
  LogsResponse,
  MatrixResponse,
  RollbackRun,
  Stage,
} from "./types";
import { cellKey } from "./types";
import { recentLogs } from "@/mock/logs";
import { DEPLOYABLES, activeRunFor, startRollback, world } from "@/mock/world";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public detail?: string,
  ) {
    super(message);
  }
}

const delay = (min: number, max: number) =>
  new Promise((r) => setTimeout(r, min + Math.random() * (max - min)));

/** Simulates AWS being unreachable, to exercise the stale-data path (R1.7). */
let simulateOutage = false;
export const setSimulateOutage = (v: boolean) => {
  simulateOutage = v;
};
export const isSimulatingOutage = () => simulateOutage;

let lastGoodMatrix: MatrixResponse | null = null;

export async function getMatrix(): Promise<MatrixResponse> {
  await delay(180, 520);
  if (simulateOutage) {
    if (!lastGoodMatrix) throw new ApiError(503, "AWS unreachable and no cached state");
    return { ...lastGoodMatrix, stale: true };
  }
  const res: MatrixResponse = {
    deployables: DEPLOYABLES,
    cells: structuredClone(world.cells),
    fetchedAt: new Date().toISOString(),
    stale: false,
  };
  lastGoodMatrix = res;
  return res;
}

export async function getDeployments(service: string, stage: Stage): Promise<Deployment[]> {
  await delay(140, 400);
  if (simulateOutage) throw new ApiError(503, "AWS unreachable");
  const list = world.deployments[cellKey(service, stage)];
  if (!list) throw new ApiError(404, `No stack for ${service} on ${stage}`);
  return structuredClone(list);
}

export async function getLogs(
  service: string,
  stage: Stage,
  filter?: string,
): Promise<LogsResponse> {
  await delay(220, 700);
  if (simulateOutage) throw new ApiError(503, "CloudWatch unreachable");
  return recentLogs(service, stage, { minutes: 10, filter });
}

/**
 * `service` is the stack/service name (e.g. biztechApi-events). The real
 * implementation maps it to the folder under `services/` before dispatching,
 * because rollback.yml takes the folder name as its input.
 */
export async function postRollback(args: {
  service: string;
  stage: Stage;
  timestamp: string;
  reason?: string;
}): Promise<RollbackRun> {
  await delay(300, 800);
  // R2.4 — refuse while a deploy or another rollback of the same
  // service+stage is running.
  const active = activeRunFor(args.service, args.stage);
  if (active && active.status !== "completed") {
    throw new ApiError(
      409,
      "A rollback is already running for this service and stage",
      active.runUrl,
    );
  }
  return startRollback(args);
}

export async function getRollbackRun(runId: string): Promise<RollbackRun> {
  await delay(60, 180);
  const run = world.runs[runId];
  if (!run) throw new ApiError(404, "No such run");
  return structuredClone(run);
}
