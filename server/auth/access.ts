/**
 * Who may do what.
 *
 * Deliberately dependency-free and pure, so it can be lifted into a shared
 * package that bt-web-v2 and Control Tower both consume. The domain rule is
 * the same one bt-web-v2 applies in src/queries/user.ts:
 *
 *     const isAdmin = email.split("@")[1] === "ubcbiztech.com";
 *
 * with one difference that matters: there, it is computed in the browser and
 * is decorative. Here it runs on the server against a verified ID token, and
 * it decides whether a request is allowed.
 */

export type Role = "viewer" | "deployer" | "admin";

/** Ordered weakest to strongest. */
export const ROLES: Role[] = ["viewer", "deployer", "admin"];

const RANK: Record<Role, number> = { viewer: 0, deployer: 1, admin: 2 };

export function atLeast(role: Role, required: Role): boolean {
  return RANK[role] >= RANK[required];
}

export interface AccessEntry {
  email: string;
  role: Role;
  note?: string;
}

export interface AccessList {
  domain: string;
  defaultRole: Role;
  users: AccessEntry[];
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function domainOf(email: string): string | null {
  const parts = normalizeEmail(email).split("@");
  return parts.length === 2 && parts[1] ? parts[1] : null;
}

/** The bt-web-v2 rule: you are one of us if your email is on the domain. */
export function isOrgMember(email: string, list: AccessList): boolean {
  return domainOf(email) === list.domain.toLowerCase();
}

/**
 * The role for an email, or null if they may not sign in at all.
 * Domain membership is required; an allowlist entry only raises the role.
 */
export function roleFor(email: string, list: AccessList): Role | null {
  if (!isOrgMember(email, list)) return null;
  const normalized = normalizeEmail(email);
  const entry = list.users.find((u) => normalizeEmail(u.email) === normalized);
  return entry?.role ?? list.defaultRole;
}

/** Validates access.json at load, so a typo fails startup rather than a login. */
export function parseAccessList(raw: unknown): AccessList {
  const o = raw as Partial<AccessList>;
  if (!o || typeof o.domain !== "string" || !o.domain.includes("."))
    throw new Error("access.json: `domain` must be a domain name");
  if (!o.defaultRole || !ROLES.includes(o.defaultRole))
    throw new Error(`access.json: \`defaultRole\` must be one of ${ROLES.join(", ")}`);
  if (!Array.isArray(o.users)) throw new Error("access.json: `users` must be an array");

  const seen = new Set<string>();
  for (const [i, u] of o.users.entries()) {
    if (!u || typeof u.email !== "string" || !u.email.includes("@"))
      throw new Error(`access.json: users[${i}].email is not an email address`);
    if (!ROLES.includes(u.role))
      throw new Error(`access.json: users[${i}].role must be one of ${ROLES.join(", ")}`);
    const key = normalizeEmail(u.email);
    if (domainOf(key) !== o.domain.toLowerCase())
      throw new Error(
        `access.json: users[${i}] (${u.email}) is not on ${o.domain}, so the entry can never apply`,
      );
    if (seen.has(key)) throw new Error(`access.json: ${u.email} is listed twice`);
    seen.add(key);
  }

  return { domain: o.domain, defaultRole: o.defaultRole, users: o.users };
}
