/**
 * Google OAuth 2.0, authorization-code flow with PKCE, run entirely on the
 * server. The browser never holds a Google token — it gets Control Tower's own
 * session cookie instead.
 *
 * `hd=ubcbiztech.com` asks Google to restrict the account chooser to the
 * Workspace domain. It is a hint, not a control, so the ID token's `hd` and
 * `email` are both re-checked after exchange.
 */
import { createHash, randomBytes } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  hostedDomain: string;
}

export function base64url(buf: Buffer) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function newPkce() {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

export function newState() {
  return base64url(randomBytes(16));
}

export function authorizeUrl(cfg: GoogleConfig, state: string, challenge: string) {
  const q = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    hd: cfg.hostedDomain,
    prompt: "select_account",
  });
  return `${AUTH_ENDPOINT}?${q}`;
}

export interface GoogleIdentity {
  email: string;
  emailVerified: boolean;
  hostedDomain: string | null;
  name?: string;
  picture?: string;
}

export async function exchangeCode(
  cfg: GoogleConfig,
  code: string,
  verifier: string,
): Promise<GoogleIdentity> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      redirect_uri: cfg.redirectUri,
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Google token exchange failed (${res.status}): ${detail.slice(0, 300)}`);
  }

  const body = (await res.json()) as { id_token?: string };
  if (!body.id_token) throw new Error("Google returned no id_token");

  // Verified against Google's JWKS even though it arrived over TLS from the
  // token endpoint. Cheap, and it removes a class of mistake.
  const { payload } = await jwtVerify(body.id_token, JWKS, {
    issuer: ISSUERS,
    audience: cfg.clientId,
  });

  const email = typeof payload.email === "string" ? payload.email : "";
  if (!email) throw new Error("Google ID token carried no email");

  return {
    email,
    emailVerified: payload.email_verified === true,
    hostedDomain: typeof payload.hd === "string" ? payload.hd : null,
    name: typeof payload.name === "string" ? payload.name : undefined,
    picture: typeof payload.picture === "string" ? payload.picture : undefined,
  };
}
