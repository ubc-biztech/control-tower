/**
 * The seam. Every screen reads through this module and neither knows nor cares
 * whether the data came from AWS or from the fabricated world.
 *
 * VITE_TOWER_DATA_SOURCE=live (default) reads real AWS through the server
 * routes in server/. =mock uses src/mock/, for demos and for working without
 * credentials.
 */
import * as live from "./liveApi";
import * as mock from "./mockApi";
import type { AuthState, Health } from "./types";

export { ApiError } from "./ApiError";

const source = (import.meta.env.VITE_TOWER_DATA_SOURCE ?? "live") === "mock" ? "mock" : "live";

export const DATA_SOURCE: "live" | "mock" = source;
export const isMock = source === "mock";

const impl = isMock ? mock : live;

export const getMatrix = impl.getMatrix;
export const getDeployments = impl.getDeployments;
export const getLogs = impl.getLogs;
export const postRollback = impl.postRollback;
export const getRollbackRun = impl.getRollbackRun;
export const getStackFunctions = isMock ? null : live.getStackFunctions;

export async function getSession(): Promise<AuthState> {
  if (isMock)
    return {
      authenticated: true,
      authConfigured: false,
      devLogin: false,
      domain: "ubcbiztech.com",
      defaultRole: "admin",
      user: { email: "mock@ubcbiztech.com", name: "Mock user", role: "admin", dev: true },
    };
  return live.getSession();
}

export const logout = isMock ? async () => {} : live.logout;

export async function getHealth(): Promise<Health> {
  if (isMock)
    return {
      ok: true,
      writesEnabled: true,
      readOnly: false,
      source: "mock",
      reason: "Fabricated data. Nothing here touches AWS.",
    };
  return live.getHealth();
}

/* The outage simulator only makes sense against the mock. */
export const setSimulateOutage = isMock ? mock.setSimulateOutage : () => {};
export const isSimulatingOutage = isMock ? mock.isSimulatingOutage : () => false;
