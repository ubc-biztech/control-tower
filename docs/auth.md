# Auth and access

Signing in requires a verified Google account on **@ubcbiztech.com**. Everyone
on the domain can read. Anything that writes requires an explicit entry in
[`access.json`](../access.json).

## Roles

| Role | Can |
|---|---|
| `viewer` | Read the matrix, deployment history and logs. **The default for anyone on the domain.** |
| `deployer` | Everything a viewer can, plus roll back a service on any environment. |
| `admin` | Everything a deployer can, plus settings when they exist. |

Granting access is a pull request to `access.json`:

```json
{ "email": "someone@ubcbiztech.com", "role": "deployer", "note": "VP Engineering — 2026/27" }
```

Revoking it is a pull request too. There is deliberately no admin UI:

- The audit trail is `git log`, which nobody can quietly edit.
- Access changes get reviewed like code.
- At term handover, `git blame access.json` says who granted what and when.

Roles are re-read from `access.json` on **every request**, not baked into the
session cookie. Merging a revocation takes effect on that person's next click,
not at their next login.

## Where the checks happen

Server-side, in `server/auth/guard.ts`. The browser is told the user's role only
so it can grey out buttons; it is never trusted. A `viewer` who calls
`POST /api/rollback` by hand gets 403 regardless of what their UI showed.

Order of checks on every request:

1. Session cookie verified (HS256, signed with `TOWER_SESSION_SECRET`).
2. Email re-checked against the domain in `access.json`.
3. Role resolved from the allowlist.
4. Route's required role compared against it.

## Deliberate difference from bt-web-v2

bt-web-v2 decides admin in `src/queries/user.ts`:

```ts
const isAdmin = email.split("@")[1] === "ubcbiztech.com";
```

That runs **in the browser**, on an attribute the browser already holds, and it
is only used to decide which nav links to render. The real gate over there is
`middleware.ts` trusting `userProfile.admin` from the backend.

Control Tower uses the same domain rule — `server/auth/access.ts` is written to
be recognisable next to that line — but runs it on the server against a
Google-verified ID token, and treats domain membership as *read* access only.
Write access needs the allowlist on top. Being on the domain should not be
enough to redeploy production.

## Sharing this logic with bt-web-v2

`server/auth/access.ts` is pure, dependency-free, and framework-free on purpose.
It is the piece worth extracting when we want one definition of "who is staff":

- **Now**: it lives here, one file, easy to read next to bt-web-v2's line.
- **Next**: publish it as `@ubc-biztech/access` from its own small repo — that
  matches the shard-out repo strategy in the requirements (§4) and both apps
  install it. The rule is ~40 lines and changes about once a year, so a package
  is cheap.
- **Not**: a monorepo. The requirements are explicit that we do not have the CI
  maturity for one.

Whoever does that should move the role rules *and* the `access.json` schema, so
the allowlist means the same thing in both apps.

## Setting up Google OAuth

Control Tower has its own OAuth client, independent of bt-web-v2's Cognito pool.

1. In the Google Cloud console for the BizTech Workspace, create an **OAuth 2.0
   Client ID**, type *Web application*.
2. Authorised redirect URI — must match `GOOGLE_REDIRECT_URI` exactly:
   - `http://localhost:5273/api/auth/callback` for local development
   - the deployed origin plus `/api/auth/callback` for production
3. Put the values in `.env`:

```
GOOGLE_CLIENT_ID=…
GOOGLE_CLIENT_SECRET=…
GOOGLE_REDIRECT_URI=http://localhost:5273/api/auth/callback
TOWER_SESSION_SECRET=…   # node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

The flow is authorization-code with PKCE, run entirely server-side. The browser
never receives a Google token — it gets Control Tower's own httpOnly session
cookie. `hd=ubcbiztech.com` narrows the Google account chooser, and because that
is a hint rather than a control, the ID token's `hd` and `email` are both
re-checked after the exchange.

## Working without OAuth

```
TOWER_DEV_LOGIN_EMAIL=someone@ubcbiztech.com npm run dev
```

Signs in as that address with no Google round-trip, so the authorization layer
can be exercised while OAuth credentials do not exist. The address still has to
pass `access.json`, so this is a way to test roles, not to bypass them. It is
**ignored when `NODE_ENV=production`**, and the UI shows a "dev login" marker in
the sidebar whenever it is on.

## What is not built yet

- **Audit storage.** `server/audit.ts` writes structured lines to stdout: sign-in,
  sign-out, denied sign-in, and denied rollback. That is enough while nothing
  mutates. R6.3 wants append-only, queryable, with before/after — worth doing at
  the same time as the write path, not before.
- **Session revocation.** Sessions last 12 hours and cannot be killed
  individually; removing someone from `access.json` is the revocation mechanism
  and it is immediate. Rotating `TOWER_SESSION_SECRET` signs everyone out.
- **Role review reminder** at term end (R6.4).
