# Tower — P0

Internal control plane for UBC BizTech infrastructure. **This is P0: a proof of
concept with a real UI and entirely fabricated data.** It exists to validate the
screens in `docs/tower-requirements.md` §6 before a single line of AWS code is
written.

```
npm install
npm run dev        # http://localhost:5273
```

No `.env` is needed. Nothing to configure.

---

## What this build does

Three v0 screens, wired to a mock world of all 20 `serverless-biztechapp`
services across `dev` / `staging` / `prod`:

| Req | Screen | State |
|---|---|---|
| R1 | **Environments** — service × environment matrix, SHA + commit message, deployed-at, actor, run link, status | UI complete, mock data |
| R2 | **Rollback** — confirm dialog with from → to, reason, the exact command, then a live run progress panel | UI complete, simulated Actions run |
| R3 | **Logs** — merged last-10-minute stream across every Lambda in a stack, filter, 10s auto-refresh, console + Insights deep links | UI complete, generated events |

Plus a per-environment view (one stage, every service), a **Services** inventory
showing that adding a deployable is a config entry (R9.3), and a left rail with
the v1 sections greyed out.

## What this build does **not** do

- **It makes zero network calls.** No AWS SDK, no Octokit, no `fetch`. Nothing
  is installed that could reach account `432714361962`.
- It holds no credentials. `.env.example` lists what the real v0 server will
  need, commented out, for reference only.
- It does not touch `serverless-biztechapp` or `bt-web-v2`. The stack-tag change
  and `rollback.yml` from the agent brief were **not** made — see
  `docs/p0-notes.md`.
- Nothing is persisted. Reload resets the world, including any rollback you ran.

The read-only rule from the requirements is enforced here by the strongest
possible means: there is no code capable of writing anything.

## Layout

```
src/
  data/deployables.json   generated from services/*/serverless.yml — 20 entries, 142 functions
  lib/
    api.ts                the seam. Shaped exactly like the future HTTP routes.
    types.ts              response shapes shared by mock and real backend
    format.ts             sha / time / bytes helpers
  mock/
    world.ts              stack + deployment state, rollback simulation
    logs.ts               CloudWatch event generation, console URL builders
    corpus.ts, rng.ts     commit messages, log templates, seeded PRNG
  components/             Shell, StatusTag, RollbackDialog, LogsDrawer
  pages/                  Matrix, ServiceDetail, Services, Logs
```

### Swapping in the real backend

Everything that would talk to AWS is behind `src/lib/api.ts`. Its five functions
map one-to-one onto the routes in the brief:

| `api.ts` | Route |
|---|---|
| `getMatrix()` | `GET /api/matrix` |
| `getDeployments(service, stage)` | `GET /api/deployments?service=&stage=` |
| `getLogs(service, stage, filter)` | `GET /api/logs?service=&stage=&filter=` |
| `postRollback({...})` | `POST /api/rollback` |
| `getRollbackRun(runId)` | `GET /api/rollback/:runId` |

Replace those five bodies with `fetch` and delete `src/mock/`. No component
imports the mock directly except for the static `deployables.json` inventory
and the AWS account/region constants.

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
