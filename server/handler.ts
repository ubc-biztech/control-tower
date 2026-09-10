import type { IncomingMessage, ServerResponse } from "node:http";
import { GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import { sts, hasCredentials } from "./aws/clients.js";
import { getMatrix } from "./aws/stacks.js";
import { getDeployments } from "./aws/deployments.js";
import { recentLogs } from "./aws/logs.js";
import { getStackResources } from "./aws/resources.js";
import {
  ALLOW_ROLLBACK,
  AUTH_CONFIGURED,
  CACHE_TTL_MS,
  DEV_LOGIN_EMAIL,
  REGION,
  loadDeployables,
  stackNameFor,
  type Stage,
} from "./config.js";
import { ageOf, stale } from "./cache.js";
import { handleAuthRoute } from "./auth/routes.js";
import { AuthError, principalFor, requireRole } from "./auth/guard.js";
import { audit } from "./audit.js";

const STAGES = new Set(["dev", "staging", "prod"]);

function send(res: ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(payload);
}

function resolveStack(service: string, stage: Stage) {
  const d = loadDeployables().find((x) => x.name === service);
  if (!d) return null;
  return { deployable: d, stackName: stackNameFor(d, stage) };
}

/** Everything under /api. Returns false if the path is not ours. */
export async function handleApi(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (!url.pathname.startsWith("/api/")) return false;

  try {
    await route(url, req, res);
  } catch (err) {
    if (err instanceof AuthError) {
      send(res, err.status, {
        error: err.status === 401 ? "Unauthenticated" : "Forbidden",
        message: err.message,
        requiredRole: err.required,
      });
      return true;
    }
    const e = err as { name?: string; message?: string; $metadata?: { httpStatusCode?: number } };
    const status = e.$metadata?.httpStatusCode ?? 500;
    // eslint-disable-next-line no-console
    console.error(`[api] ${url.pathname} ->`, e.name, e.message);
    send(res, status >= 400 ? status : 500, {
      error: e.name ?? "Error",
      message: e.message ?? "Request failed",
    });
  }
  return true;
}

async function route(url: URL, req: IncomingMessage, res: ServerResponse) {
  const path = url.pathname;

  /* ---- auth: /api/auth/* is the only unauthenticated surface ---------- */
  if (path.startsWith("/api/auth/")) {
    if (await handleAuthRoute(path, url, req, res)) return;
  }

  /* ---- health / capabilities ---------------------------------------- */
  if (path === "/api/health") {
    if (!hasCredentials())
      return send(res, 200, {
        ok: false,
        reason: "No AWS credentials in the server environment",
        region: REGION,
        writesEnabled: false,
      });
    const principal = await principalFor(req);
    if (!principal)
      return send(res, 200, {
        ok: true,
        region: REGION,
        readOnly: true,
        writesEnabled: false,
        authConfigured: AUTH_CONFIGURED,
        devLogin: Boolean(DEV_LOGIN_EMAIL),
        authenticated: false,
      });

    const id = await sts.send(new GetCallerIdentityCommand({}));
    return send(res, 200, {
      ok: true,
      account: id.Account,
      arn: id.Arn,
      region: REGION,
      cacheTtlMs: CACHE_TTL_MS,
      readOnly: true,
      // Writes need a deployer role AND a write path. Neither is enough alone,
      // and the write path does not exist yet.
      writesEnabled: ALLOW_ROLLBACK,
      authConfigured: AUTH_CONFIGURED,
      devLogin: Boolean(DEV_LOGIN_EMAIL),
      authenticated: true,
      role: principal.role,
      email: principal.email,
    });
  }

  /* ---- everything below requires a signed-in viewer ------------------- */
  const principal = await principalFor(req);
  requireRole(principal, "viewer");

  /* ---- R1 version matrix -------------------------------------------- */
  if (path === "/api/matrix") {
    try {
      return send(res, 200, await getMatrix());
    } catch (err) {
      // R1.7 — serve last-known state rather than nothing.
      const last = stale<Awaited<ReturnType<typeof getMatrix>>>("stacks");
      if (!last) throw err;
      const cachedMatrix = await getMatrix().catch(() => null);
      if (cachedMatrix) return send(res, 200, cachedMatrix);
      throw err;
    }
  }

  /* ---- R1.5 deployment history --------------------------------------- */
  if (path === "/api/deployments") {
    const service = url.searchParams.get("service") ?? "";
    const stage = url.searchParams.get("stage") ?? "";
    if (!STAGES.has(stage)) return send(res, 400, { error: "BadRequest", message: "bad stage" });
    const found = resolveStack(service, stage as Stage);
    if (!found) return send(res, 404, { error: "NotFound", message: `Unknown service ${service}` });

    const { deployments, bucket } = await getDeployments(service, stage, found.stackName);
    return send(res, 200, {
      deployments,
      bucket,
      stackName: found.stackName,
      cacheAgeMs: ageOf(`deployments:${found.stackName}`, CACHE_TTL_MS),
    });
  }

  /* ---- R3 log finder -------------------------------------------------- */
  if (path === "/api/logs") {
    const service = url.searchParams.get("service") ?? "";
    const stage = url.searchParams.get("stage") ?? "";
    const filter = url.searchParams.get("filter") ?? undefined;
    const minutes = Number(url.searchParams.get("minutes") ?? 10);
    if (!STAGES.has(stage)) return send(res, 400, { error: "BadRequest", message: "bad stage" });
    const found = resolveStack(service, stage as Stage);
    if (!found) return send(res, 404, { error: "NotFound", message: `Unknown service ${service}` });

    return send(
      res,
      200,
      await recentLogs(found.stackName, {
        minutes: Number.isFinite(minutes) ? Math.min(Math.max(minutes, 1), 60) : 10,
        filter,
      }),
    );
  }

  /* ---- function inventory for a stack --------------------------------- */
  if (path === "/api/functions") {
    const service = url.searchParams.get("service") ?? "";
    const stage = url.searchParams.get("stage") ?? "";
    if (!STAGES.has(stage)) return send(res, 400, { error: "BadRequest", message: "bad stage" });
    const found = resolveStack(service, stage as Stage);
    if (!found) return send(res, 404, { error: "NotFound", message: `Unknown service ${service}` });
    return send(res, 200, await getStackResources(found.stackName));
  }

  /* ---- R2 rollback: NOT IMPLEMENTED ----------------------------------- */
  if (path === "/api/rollback") {
    if (req.method !== "POST")
      return send(res, 405, { error: "MethodNotAllowed", message: "POST only" });

    // Authorization runs before anything else, so the allowlist is enforced
    // now rather than when the write path is finally built.
    const actor = requireRole(principal, "deployer");
    audit("rollback.denied", {
      email: actor.email,
      role: actor.role,
      reason: "write path not implemented",
    });
    // This build has no write path at all. There is no workflow_dispatch call
    // in the tree, and no GitHub client is installed. Enabling the flag does
    // not change that — it only changes this message.
    return send(res, 501, {
      error: "NotImplemented",
      message: ALLOW_ROLLBACK
        ? "Rollback is flagged on but not implemented in this build."
        : "This build is read-only. Rollback is not implemented.",
      readOnly: true,
    });
  }

  return send(res, 404, { error: "NotFound", message: `No route ${path}` });
}
