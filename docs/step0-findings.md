# Step 0 findings — verified against AWS

Run 2026-09-09 against account **432714361962**, `us-west-2`, read-only calls
only. These are the checks `docs/tower-v0-agent-brief.md` asked for before
building anything.

| # | Check | Result |
|---|---|---|
| 1 | Stacks match `{service}-{stage}` | **Pass, with caveats** — see below |
| 2 | Resources for one stack list functions + deployment bucket | **Pass** |
| 3 | Deployment bucket holds multiple timestamped artifacts | **Pass** — exactly 5 |
| 4 | `sls deploy list` / `sls rollback --timestamp` in Framework v4 | **NOT VERIFIED** |
| 5 | `FilterLogEvents` returns events | **Pass** |

## 1. Stacks

74 stacks in the account: 26 `-dev`, 12 `-staging`, 23 `-prod`, 13 that are not
service stacks at all (CDKToolkit, `amplify-*`, `bizSocket`, `imposter-game`,
`biztech-image-handler`, the 2019 `biztechapp-*` stacks).

Three things the requirements did not predict:

- **Staging is not empty.** Twelve staging stacks exist. The requirements say no
  pipeline deploys to staging, and that is still true — these were deployed by
  hand and then abandoned. Two are sitting in `UPDATE_ROLLBACK_COMPLETE` **since
  July 2021**: `biztechApi-prizes-staging` and `biztechApi-stickers-staging`.
  They are the only failed stacks in the account.
- **13 deployed stacks are not in `services/`**: `biztechApi-memberships`
  (dev/staging/prod), `biztechApi-partnerships` (dev/prod), `biztechApi-invites`
  (dev/staging), `biztechApi-admin` (staging), `biztechApi-discord-roles` (dev),
  `discord-roles` (dev), `biztechApp` (dev/staging/prod). Control Tower surfaces
  these on the home screen rather than hiding them — AWS is the source of truth
  (R1.2), and a stack nobody owns is exactly what this tool is for.
- **12 of the 60 service × stage combinations have no stack at all**, almost all
  on staging.

## 2. Stack tags — the git metadata problem is confirmed

Every stack carries exactly one tag:

```json
[{ "Key": "STAGE", "Value": "prod" }]
```

No `git:sha`, no `ci:run_url`, nothing. So **every cell in the matrix shows a
timestamp and no commit**, which is the single biggest thing holding the version
matrix back. Adding `stackTags` to the deploy pipeline (Step 1 of the brief) is
a one-line change and is worth doing before anything else in v1.

## 3. Deployment bucket

Confirmed for `biztechApi-events` on dev and prod. Bucket comes from the stack's
`ServerlessDeploymentBucket` resource, e.g.
`biztechapi-events-prod-serverlessdeploymentbucket-ih1x5xttn4bc`.

Layout is `serverless/{service}/{stage}/{epochMs}-{iso}/` with exactly 5
timestamped directories, each holding three objects:

```
biztechApi-events.zip                    ~466 KB   the artifact
compiled-cloudformation-template.json    ~50 KB
serverless-state.json                    ~130 KB
```

**`serverless-state.json` is the fix for rollback losing the SHA.** It contains
`service.provider`, including a `stackTags` field — today `null`, because
nothing is stamped. Once the pipeline stamps tags, every past artifact will
carry the tags of *its own* deploy, sitting in S3 next to it. That means
deployment history can show a real SHA per row, and a rollback can name the
commit it is rolling back to, with no new sidecar file and no database. The
earlier plan to have the pipeline write extra metadata is unnecessary.

## 4. `sls rollback` — still unverified, and it blocks R2

Not checked. The Serverless CLI is not installed here, and the only meaningful
test would run against a real stack while an event is live. Open question 10.2
in the requirements stands: **verify `sls deploy list` and
`sls rollback --timestamp` behave in Framework v4 with esbuild packaging before
building the write path.** If they do not, R2's whole mechanism changes.

The artifact layout in check 3 is what Control Tower actually reads, and that is
confirmed, so the read side does not depend on this.

## 5. Logs

`FilterLogEvents` works. For `biztechApi-events-prod`, 14 Lambda functions
discovered from stack resources, 14 log groups all present, 47 events in a
10-minute window and 270 in three hours. Function names are discovered, not
guessed (R3.2).

Worth noting: the static function list parsed out of `serverless.yml` for
`deployables.json` said 10 functions for `events`; the stack has **14**. The
live path discovers from `ListStackResources` and is right; that static list is
now used only by the mock.

## 6. Credentials — needs fixing before anyone else runs this

`sts:GetCallerIdentity` returns:

```
arn:aws:iam::432714361962:root
```

These are **root account access keys**, not the `serverless-biztechapp` CI IAM
user the brief specified. That matters more than it might look:

- Root keys cannot be scoped. R9.5 says Control Tower's AWS permissions are
  read-only; with root, that guarantee comes only from the application code
  being careful, not from AWS refusing the call.
- Root keys cannot be revoked without disrupting anything else that uses them,
  and they bypass every IAM policy and SCP.
- AWS's own guidance is to delete root access keys entirely.

Control Tower compensates in the only way it can — see `docs/read-only.md` — but
that is defence in depth, not a substitute. **Create the scoped read-only IAM
user in `docs/read-only.md` and delete the root keys.**
