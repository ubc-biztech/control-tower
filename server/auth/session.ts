/**
 * Stateless sessions in a signed, httpOnly cookie. No database (R9.2), and
 * nothing sensitive in the payload — the cookie says who you are and what
 * role the allowlist gave you at sign-in time.
 *
 * Roles are re-resolved from access.json on every request, so revoking someone
 * by merging a PR takes effect on their next request, not on their next login.
 */
import { SignJWT, jwtVerify } from "jose";
import type { Role } from "./access.js";

export const SESSION_COOKIE = "ct_session";
const MAX_AGE_SECONDS = 12 * 60 * 60;

export interface SessionClaims {
  email: string;
  name?: string;
  picture?: string;
  /** The role at sign-in. Advisory — the guard re-resolves it per request. */
  role: Role;
}

function key(secret: string) {
  return new TextEncoder().encode(secret);
}

export async function issueSession(secret: string, claims: SessionClaims): Promise<string> {
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer("biztech-control-tower")
    .setAudience("biztech-control-tower")
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(key(secret));
}

export async function readSession(
  secret: string,
  token: string | undefined,
): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(secret), {
      issuer: "biztech-control-tower",
      audience: "biztech-control-tower",
    });
    if (typeof payload.email !== "string") return null;
    return {
      email: payload.email,
      name: typeof payload.name === "string" ? payload.name : undefined,
      picture: typeof payload.picture === "string" ? payload.picture : undefined,
      role: payload.role as Role,
    };
  } catch {
    return null;
  }
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function sessionCookie(token: string, secure: boolean): string {
  return [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    secure ? "Secure" : "",
    `Max-Age=${MAX_AGE_SECONDS}`,
  ]
    .filter(Boolean)
    .join("; ");
}

export function clearCookie(secure: boolean): string {
  return [
    `${SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    secure ? "Secure" : "",
    "Max-Age=0",
  ]
    .filter(Boolean)
    .join("; ");
}
