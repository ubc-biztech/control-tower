# Tower P0 — build notes

What this build is, what it deliberately isn't, and what the real v0 has to
resolve. Written 2026-09-09.

## Deviations from `docs/tower-v0-agent-brief.md`

The brief describes v0. This is **P0**, a UI-validation pass ahead of it. Three
deliberate departures, all directed:

1. **Vite + React instead of Next.js.** Requested. There is no server side in
   this build, so the App Router bought nothing. When the real backend arrives it
   can be a Next app that reuses `src/` wholesale, or this app plus a small API
   server — the seam at `src/lib/api.ts` supports either. Routing is `HashRouter`
   so the static build works from any path without server rewrites.
2. **Everything is mocked.** No AWS SDK, no Octokit, no `fetch`. Requested, so the
   screens can be judged before anything touches the BizTech account.
3. **Step 0, Step 1 and Step 2 were not performed.** No credentials were used, no
   AWS API was called, and `serverless-biztechapp` was **not modified** — no
   `stackTags` in `serverless.common.yml`, no `rollback.yml`, no branch, no
   commit. The repo was read (service names and function keys) and nothing else.
   There is an event running; the instruction was to leave prod alone entirely.

## Still unverified — blocks real v0

These are the brief's Step 0 checks. None have been run, and the first is a
genuine design risk:

- **`sls rollback --timestamp` in Framework v4.** Open question 10.2 in the
  requirements. If v4 dropped it, or if esbuild-packaged stacks don't produce
  the timestamps `deploy list` expects, R2's whole mechanism changes. Check this
  before building anything server-side.
- Stack names actually matching `{service}-{stage}` for all 20 services.
- The deployment bucket holding multiple timestamped artifacts per stack.
- `FilterLogEvents` returning events for a discovered log group.

The mock assumes all four hold. If any doesn't, the UI still stands but the data
layer behind it changes shape.

## Modelled honestly, because it constrains the UI

**Past deployments carry no git SHA.** Stack tags describe only the *current*
deploy; the S3 artifacts behind earlier deploys record a timestamp and nothing
else. So the rollback dialog's "To" side shows `no git metadata` and a timestamp
for every candidate, and the deployment history shows a SHA on exactly one row.
This is the real constraint, and it's the least satisfying part of the design —
you roll back to a time, not to a commit. The v1 fix is for the pipeline to write
a small metadata object next to each artifact. Worth doing early.

**A rollback erases the current SHA too.** After rolling back, the stack tags
describe an artifact with no recorded commit, so the matrix cell drops to
`no git metadata`. The mock reproduces this. It looks like a regression in the UI
and it is — same v1 fix.

**Staging is mostly empty.** No pipeline deploys to it (requirements §1), so most
services show `no deploys` there. Three services carry a staging deploy in the
mock so the column isn't dead. The column header says `no pipeline`.

## What the mock fabricates

- 20 services × 3 stages, from real service names and function keys read out of
  `services/*/serverless.yml`. 142 functions total.
- Deterministic per service+stage (seeded PRNG on the cell key), so the matrix
  doesn't reshuffle on every reload. Log events are seeded on a 10-second bucket,
  so auto-refresh produces new-but-plausible traffic.
- Every cell state is represented on purpose, so no UI path is untested:
  `current`, `behind` (btx / quizzes / registrations / interactions on prod),
  `failed` (payments on prod), `unknown` (stickers on prod), `no git metadata`
  (qr on dev and prod, investments on prod), `absent` (bots on prod, staging
  broadly), and `rolling-back` while a run is in flight.
- Rollback runs as a six-step fake Actions workflow over ~8 seconds, then mutates
  the world: the target artifact becomes current and a distinct `rollback` row
  with actor and reason lands in the history (R2.5).
- R2.4 is enforced — a second rollback of the same service+stage while one is in
  flight returns 409, and the dialog surfaces it.
- The `outage` switch in the header simulates AWS being unreachable, to exercise
  R1.7: the matrix falls back to last-known state with a stale banner and
  rollback is disabled.

## Deep links are constructed but unverified

`logGroupConsoleUrl()` follows the documented double-encoding (`%` → `$25`) and
should be right. `insightsUrl()` builds the console's fragment format by hand and
is the fiddly one the brief warned about — treat it as unproven until someone
clicks it against a real log group. The per-log-group links are the ones to trust.

## Known gaps in this build

- No auth. The brief's shared-password gate needs a server to be worth anything;
  there is no server.
- `behindBy` is asserted by the mock, not computed. Real drift detection (R1.4)
  needs artifact timestamps compared across stages.
- Frontends (`bt-web-v2`, Amplify) aren't in the matrix. That's R1.6, v1.
- The rollback dialog doesn't refuse a rollback *past* a migration (R2.6, v1).
- Log filtering is a client-side substring match. Real CloudWatch filter-pattern
  syntax goes to `FilterLogEvents` and behaves differently.
- No tests. There is no logic here worth testing that will survive contact with
  the real backend.

## Directory name

The brief names the repo `ubc-biztech/tower`. This working copy sits at
`bt-tower/`, renamed mid-build to match the `bt-*` convention of `bt-web-v2`.
The product name is still Tower.
