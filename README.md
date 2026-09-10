# BizTech Control Tower — P0

Internal control plane for UBC BizTech infrastructure. **Reads real AWS. Writes
nothing.**

```
npm install
cp .env.example .env     # add AWS credentials
npm run dev              # http://localhost:5273
```

`npm run dev` serves the UI and the read-only API from one process. Credentials
stay in Node; the browser never sees them. Without credentials, run the
fabricated world instead:

```
VITE_TOWER_DATA_SOURCE=mock npm run dev
```

---

## What this build does

| Req | Screen | State |
|---|---|---|
| R1 | **Environments** — service × environment matrix from CloudFormation stack tags, plus stacks in the account no deployable claims | **Live** |
| R1.5 | **Deployment history** — the last 5 artifacts from each stack's deployment bucket | **Live** |
| R3 | **Logs** — last 10 minutes across every Lambda in a stack, discovered from stack resources, filter, 10s auto-refresh, console + Insights deep links | **Live** |
| R2 | **Rollback** — the confirm dialog exists and shows real from → to, but the button is disabled and the route returns 501 | **Not built** — it is the write path |

Plus a per-environment view (one stage, every service), a **Services** inventory
showing that adding a deployable is a config entry (R9.3), and a left rail with
the v1 sections greyed out.

## What this build does **not** do

- **No writes to AWS.** Six read commands exist in the whole tree and a build
  check fails if a seventh appears. See **[docs/read-only.md](docs/read-only.md)**.
- **No rollback.** `POST /api/rollback` returns 501; the UI disables the button
  and says why. Rollback belongs in GitHub Actions (R2.3) and needs open
  question 10.2 answered first.
- **No auth.** Single user, no login. That is R6, v1.
- **No database, no log storage.** State is AWS. The cache is in memory with a
  30-second TTL.
- It does not touch `serverless-biztechapp` or `bt-web-v2`.

## Read this before running it against AWS

The credentials in use are **root account access keys**, not a scoped IAM user.
`docs/read-only.md` has the policy for the read-only user to create instead, and
`docs/step0-findings.md` explains why it matters.

## Where things live

**Every file is named after the thing it exports.** If you are looking for the
sidebar, it is `Sidebar.tsx`.

```
src/
  App.tsx                          routes, shared matrix state, drawer/dialog wiring

  components/
    layout/
      AppLayout.tsx                sidebar + top bar + routed page
      Sidebar.tsx                  the left navigation rail
      TopBar.tsx                   read-only badge, freshness, refresh
    DeploymentCell.tsx             one service on one environment, with its row actions
    LogsDrawer.tsx                 the logs panel (R3)
    RollbackDialog.tsx             the confirm dialog and run progress (R2)
    PageHeader.tsx                 Apollo-style page banner
    StatTiles.tsx                  the counter tiles under a banner
    StatusTag.tsx                  current / behind / failed / unknown badge
    ui/                            shadcn-style primitives, same conventions as bt-web-v2
                                   button, badge, input, dialog, sheet, switch,
                                   tooltip, table, callout, spinner, toast

  pages/
    EnvironmentsPage.tsx           home: the service x environment matrix (R1)
    EnvironmentDetailPage.tsx      one stage, every service
    ServiceDetailPage.tsx          one service on one stage: deployment history
    ServicesPage.tsx               the deployable inventory
    LogsPage.tsx                   pick a service, open the logs drawer

  lib/
    api.ts                         the seam. Shaped exactly like the future HTTP routes.
    types.ts                       response shapes shared by mock and real backend
    format.ts                      sha / time / bytes helpers
    utils.ts                       cn(), same as bt-web-v2's

  mock/
    world.ts                       stack + deployment state, rollback simulation
    logs.ts                        CloudWatch event generation, console URL builders
    corpus.ts, rng.ts              commit messages, log templates, seeded PRNG

  data/deployables.json            generated from services/*/serverless.yml
                                   20 entries, 142 functions
```

Conventions: one exported component per file, file name matches it. Pages are
`<Thing>Page.tsx` exporting `<Thing>Page`. Shared primitives live in
`components/ui/`; anything with product knowledge in it lives a level up.

### The server

`server/` holds everything that talks to AWS. It runs inside the Vite dev server
as middleware, so `npm run dev` is one process, and standalone via
`npm run serve:api` for deployment later.

```
server/
  handler.ts        the routes
  config.ts         env, .env loading, deployable inventory
  cache.ts          30s TTL, collapses concurrent misses
  aws/
    clients.ts      the read-only boundary
    stacks.ts       GET /api/matrix
    resources.ts    function + deployment-bucket discovery, 5min TTL
    deployments.ts  GET /api/deployments
    logs.ts         GET /api/logs, console + Insights URLs
```

| Route | Reads |
|---|---|
| `GET /api/health` | `sts:GetCallerIdentity` — account, region, capabilities |
| `GET /api/matrix` | one `DescribeStacks` pass over the account |
| `GET /api/deployments?service=&stage=` | `ListStackResources` → `ListObjectsV2` |
| `GET /api/logs?service=&stage=&filter=` | `ListStackResources` → `FilterLogEvents` per group |
| `GET /api/functions?service=&stage=` | `ListStackResources` |
| `POST /api/rollback` | nothing — returns 501 |

The whole matrix costs one `DescribeStacks` pagination rather than 60 named
lookups, because that call returns every stack with its tags.

`src/lib/api.ts` picks between `liveApi.ts` and `mockApi.ts`; no screen knows
which it got.

## Adding a deployable

Append to `src/data/deployables.json`:

```json
{
  "name": "biztechApi-events",
  "kind": "serverless",
  "repo": "ubc-biztech/serverless-biztechapp",
  "path": "services/events",
  "stackPattern": "biztechApi-events-{stage}",
  "stages": ["dev", "staging", "prod"],
  "functions": ["eventCreate", "eventGetAll"]
}
```

`stackPattern` is the join key, not the folder — a service that moves to its own
repo keeps working with only `repo` and `path` changed. (`functions` is a P0
convenience so the mock knows what log groups to invent; the real v0 discovers
them from `ListStackResources`.)

## Design

**Same component stack as `bt-web-v2`** — shadcn/ui conventions (Radix
primitives + `class-variance-authority` + a `cn()` of `clsx`/`tailwind-merge`),
`lucide-react` icons, Urbanist, and shadcn's HSL CSS-variable tokens. The
primitives live in `src/components/ui/` and are written the same way bt-web-v2
writes its own, so anything here can move between the two repos.

**Coloured and laid out like Palantir Apollo**: a dark navy left rail against a
near-white content area, hairline borders, 4px radii, no shadows outside
overlays, and dense tables rather than cards. The rail's navy is BizTech's own
`bt-blue-600`, so it reads as ours rather than as a copy. Monospace for SHAs,
timestamps, stack names, and log lines; status is a soft-filled `Badge`; actions
live in the row they act on. The logo and favicon are lifted from `bt-web-v2`.

There is no Blueprint.js. The requirements suggested it, but matching bt-web-v2's
stack matters more than the shortcut, and Apollo's look is a palette and a
layout, not a component library.
