import type { IncomingMessage, ServerResponse } from "node:http";
import {
  AUTH_CONFIGURED,
  DEV_LOGIN_EMAIL,
  GOOGLE,
  IS_PRODUCTION,
  SESSION_SECRET,
  loadAccessList,
} from "../config.js";
import { roleFor } from "./access.js";
import { authorizeUrl, exchangeCode, newPkce, newState, type GoogleConfig } from "./google.js";
import { clearCookie, issueSession, parseCookies, sessionCookie } from "./session.js";
import { principalFor } from "./guard.js";
import { audit } from "../audit.js";

/** The PKCE verifier and state ride in short-lived httpOnly cookies. */
const FLOW_COOKIE = "ct_oauth";
const FLOW_MAX_AGE = 600;

function googleConfig(): GoogleConfig {
  return { ...GOOGLE, hostedDomain: loadAccessList().domain };
}

function flowCookie(value: string, secure: boolean) {
  return [
    `${FLOW_COOKIE}=${encodeURIComponent(value)}`,
    "Path=/api/auth",
    "HttpOnly",
    "SameSite=Lax",
    secure ? "Secure" : "",
    `Max-Age=${FLOW_MAX_AGE}`,
  ]
    .filter(Boolean)
    .join("; ");
}

function json(res: ServerResponse, status: number, body: unknown, headers: string[] = []) {
  const h: Record<string, string | string[]> = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  };
  if (headers.length) h["set-cookie"] = headers;
  res.writeHead(status, h);
  res.end(JSON.stringify(body));
}

function redirect(res: ServerResponse, location: string, headers: string[] = []) {
  const h: Record<string, string | string[]> = { location };
  if (headers.length) h["set-cookie"] = headers;
  res.writeHead(302, h);
  res.end();
}

export async function handleAuthRoute(
  path: string,
  url: URL,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const secure = IS_PRODUCTION;

  /* Who am I? */
  if (path === "/api/auth/me") {
    const principal = await principalFor(req);
    const list = loadAccessList();
    json(res, 200, {
      authenticated: Boolean(principal),
      authConfigured: AUTH_CONFIGURED,
      devLogin: Boolean(DEV_LOGIN_EMAIL),
      domain: list.domain,
      defaultRole: list.defaultRole,
      user: principal
        ? {
            email: principal.email,
            name: principal.name,
            picture: principal.picture,
            role: principal.role,
            dev: principal.dev,
          }
        : null,
    });
    return true;
  }

  /* Start the Google flow. */
  if (path === "/api/auth/login") {
    if (!AUTH_CONFIGURED) {
      json(res, 503, {
        error: "AuthNotConfigured",
        message:
          "Google OAuth is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and TOWER_SESSION_SECRET. See docs/auth.md.",
      });
      return true;
    }
    const state = newState();
    const { verifier, challenge } = newPkce();
    const flow = Buffer.from(JSON.stringify({ state, verifier })).toString("base64url");
    redirect(res, authorizeUrl(googleConfig(), state, challenge), [flowCookie(flow, secure)]);
    return true;
  }

  /* Google sends the user back here. */
  if (path === "/api/auth/callback") {
    if (!AUTH_CONFIGURED) {
      json(res, 503, { error: "AuthNotConfigured", message: "Google OAuth is not configured." });
      return true;
    }

    const fail = (reason: string) => {
      audit("auth.denied", { reason });
      redirect(res, `/#/login?error=${encodeURIComponent(reason)}`, [flowCookie("", secure)]);
    };

    const error = url.searchParams.get("error");
    if (error) return fail(error === "access_denied" ? "You cancelled sign-in." : error), true;

    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const raw = parseCookies(req.headers.cookie)[FLOW_COOKIE];
    if (!code || !state || !raw) return fail("Sign-in did not complete. Try again."), true;

    let flow: { state: string; verifier: string };
    try {
      flow = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    } catch {
      return fail("Sign-in state was unreadable. Try again."), true;
    }
    if (flow.state !== state) return fail("Sign-in state did not match. Try again."), true;

    let identity;
    try {
      identity = await exchangeCode(googleConfig(), code, flow.verifier);
    } catch (e) {
      return fail(e instanceof Error ? e.message : "Google sign-in failed."), true;
    }

    const list = loadAccessList();
    if (!identity.emailVerified) return fail("That Google account has no verified email."), true;
    if (identity.hostedDomain && identity.hostedDomain.toLowerCase() !== list.domain.toLowerCase())
      return fail(`Control Tower is for @${list.domain} accounts.`), true;

    const role = roleFor(identity.email, list);
    if (!role) {
      audit("auth.denied", { email: identity.email, reason: "not on domain" });
      return fail(`${identity.email} is not an @${list.domain} account.`), true;
    }

    const token = await issueSession(SESSION_SECRET, {
      email: identity.email.toLowerCase(),
      name: identity.name,
      picture: identity.picture,
      role,
    });
    audit("auth.signin", { email: identity.email, role });
    redirect(res, "/#/", [sessionCookie(token, secure), flowCookie("", secure)]);
    return true;
  }

  if (path === "/api/auth/logout") {
    const principal = await principalFor(req);
    if (principal) audit("auth.signout", { email: principal.email });
    json(res, 200, { ok: true }, [clearCookie(secure)]);
    return true;
  }

  return false;
}
