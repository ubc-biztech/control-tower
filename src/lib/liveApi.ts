/**
 * Live data, read from the server routes in server/. Those routes hold the AWS
 * credentials; this file only ever talks to same-origin /api.
 *
 * Read-only: there is no request here that mutates anything. /api/rollback
 * exists but the server answers 501 — see docs/read-only.md.
 */
import { ApiError } from "./ApiError";
import type {
  AuthState,
  Deployment,
  Health,
  LogsResponse,
  MatrixResponse,
  RollbackRun,
  Stage,
} from "./types";

async function get<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      credentials: "same-origin",
      headers: { accept: "application/json" },
    });
  } catch {
    throw new ApiError(0, "Control Tower's API is not reachable. Is `npm run dev` running?");
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Tell the session layer the cookie is gone, so the app shows the login
    // screen instead of an error on every panel.
    if (res.status === 401)
      window.dispatchEvent(new CustomEvent("control-tower:unauthenticated"));
    throw new ApiError(
      res.status,
      (body as { message?: string }).message ?? `${res.status} ${res.statusText}`,
    );
  }
  return body as T;
}

export async function getSession(): Promise<AuthState> {
  return get<AuthState>("/api/auth/me");
}

export async function logout(): Promise<void> {
  await get("/api/auth/logout");
}

export async function getHealth(): Promise<Health> {
  const h = await get<Omit<Health, "source">>("/api/health");
  return { ...h, source: "live" };
}

export async function getMatrix(): Promise<MatrixResponse> {
  return get<MatrixResponse>("/api/matrix");
}

export async function getDeployments(service: string, stage: Stage): Promise<Deployment[]> {
  const res = await get<{ deployments: Deployment[] }>(
    `/api/deployments?service=${encodeURIComponent(service)}&stage=${stage}`,
  );
  return res.deployments;
}

export async function getLogs(
  service: string,
  stage: Stage,
  filter?: string,
): Promise<LogsResponse> {
  const q = new URLSearchParams({ service, stage });
  if (filter) q.set("filter", filter);
  return get<LogsResponse>(`/api/logs?${q}`);
}

export async function getStackFunctions(
  service: string,
  stage: Stage,
): Promise<{ lambdaFunctionNames: string[]; deploymentBucket: string | null }> {
  const q = new URLSearchParams({ service, stage });
  return get(`/api/functions?${q}`);
}

/** Always fails in this build. The server has no write path. */
export async function postRollback(args: {
  service: string;
  stage: Stage;
  timestamp: string;
  reason?: string;
}): Promise<RollbackRun> {
  return get<RollbackRun>("/api/rollback", {
    method: "POST",
    body: JSON.stringify(args),
  });
}

export async function getRollbackRun(_runId: string): Promise<RollbackRun> {
  throw new ApiError(501, "Rollback is not implemented in this build.");
}
