import type { IncomingMessage } from "node:http";
import { DEV_LOGIN_EMAIL, SESSION_SECRET, loadAccessList } from "../config.js";
import { atLeast, roleFor, type Role } from "./access.js";
import { SESSION_COOKIE, parseCookies, readSession } from "./session.js";

export interface Principal {
  email: string;
  name?: string;
  picture?: string;
  role: Role;
  /** True when signed in through TOWER_DEV_LOGIN_EMAIL rather than Google. */
  dev: boolean;
}

/**
 * Who is making this request, or null.
 *
 * The role is resolved from access.json now, not from the cookie, so removing
 * someone from the allowlist takes effect on their very next request.
 */
export async function principalFor(req: IncomingMessage): Promise<Principal | null> {
  const list = loadAccessList();

  if (DEV_LOGIN_EMAIL) {
    const role = roleFor(DEV_LOGIN_EMAIL, list);
    if (!role) return null;
    return { email: DEV_LOGIN_EMAIL, name: "Local dev", role, dev: true };
  }

  if (!SESSION_SECRET) return null;
  const cookies = parseCookies(req.headers.cookie);
  const claims = await readSession(SESSION_SECRET, cookies[SESSION_COOKIE]);
  if (!claims) return null;

  const role = roleFor(claims.email, list);
  if (!role) return null; // removed from the domain since sign-in

  return { email: claims.email, name: claims.name, picture: claims.picture, role, dev: false };
}

export class AuthError extends Error {
  constructor(
    public status: 401 | 403,
    message: string,
    public required?: Role,
  ) {
    super(message);
  }
}

export function requireRole(principal: Principal | null, required: Role): Principal {
  if (!principal) throw new AuthError(401, "Sign in to continue");
  if (!atLeast(principal.role, required))
    throw new AuthError(
      403,
      `This needs the ${required} role. You have ${principal.role}. Access is granted by a pull request to access.json.`,
      required,
    );
  return principal;
}
