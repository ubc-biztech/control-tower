# The read-only guarantee

Control Tower reads AWS. It does not write to it, and this build has no code
that could. This document says how that is enforced and what it would take to
change it deliberately.

## How it is enforced

**1. Only read commands exist in the tree.** Every AWS SDK call lives under
`server/aws/`. The complete set of operations the application can perform:

| Command | Used by |
|---|---|
| `DescribeStacksCommand` | version matrix |
| `ListStackResourcesCommand` | function + deployment-bucket discovery |
| `ListObjectsV2Command` | deployment history |
| `GetObjectCommand` | reserved for `serverless-state.json` |
| `FilterLogEventsCommand` | log finder |
| `GetCallerIdentityCommand` | health check |

**2. A check fails the build if that changes.** `npm run verify:readonly` (run
by `npm run build`) walks `server/` and rejects any `@aws-sdk` import that is
not on the allowlist in `scripts/verify-readonly.mjs`. Adding a `Create*`,
`Update*`, `Put*` or `Delete*` command is a build failure, not a code review
miss.

**3. Credentials never reach the browser.** The same check rejects any
`@aws-sdk` import or `AWS_ACCESS_KEY_ID` reference under `src/`. Credentials are
read from `process.env` in `server/config.ts`, which the client bundle cannot
import. Vite only exposes `VITE_`-prefixed variables to the browser, and no AWS
variable has that prefix.

**4. The one write route refuses.** `POST /api/rollback` returns 501. There is
no `workflow_dispatch` call in the tree and no GitHub client installed. The
`TOWER_ALLOW_ROLLBACK` flag changes the error message and nothing else.

## What this does not protect against

The credentials currently in use are **root account access keys** — see
`docs/step0-findings.md` §6. Everything above is application-level discipline.
With root credentials, AWS itself will happily allow any call the code makes.
The guarantee is only as strong as the code, and it should be stronger than that.

## The IAM user to create instead

Create an IAM user `control-tower-reader` with no console access, one access
key, and this policy. Then put its key in Control Tower's environment and
**delete the root access keys**.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ReadStacks",
      "Effect": "Allow",
      "Action": [
        "cloudformation:DescribeStacks",
        "cloudformation:ListStacks",
        "cloudformation:ListStackResources",
        "cloudformation:DescribeStackEvents"
      ],
      "Resource": "*"
    },
    {
      "Sid": "ReadDeploymentBuckets",
      "Effect": "Allow",
      "Action": ["s3:ListBucket", "s3:GetObject"],
      "Resource": [
        "arn:aws:s3:::*serverlessdeploymentbucket*",
        "arn:aws:s3:::*serverlessdeploymentbucket*/*"
      ]
    },
    {
      "Sid": "ReadLogs",
      "Effect": "Allow",
      "Action": [
        "logs:DescribeLogGroups",
        "logs:DescribeLogStreams",
        "logs:FilterLogEvents",
        "logs:GetLogEvents",
        "logs:StartQuery",
        "logs:GetQueryResults"
      ],
      "Resource": "arn:aws:logs:us-west-2:432714361962:log-group:/aws/lambda/*"
    },
    {
      "Sid": "Identity",
      "Effect": "Allow",
      "Action": "sts:GetCallerIdentity",
      "Resource": "*"
    }
  ]
}
```

With that user, the read-only property is enforced by AWS. The application-level
checks then become a second layer rather than the only one.

## When rollback is built

Rollback is a `workflow_dispatch` against `serverless-biztechapp`, run by GitHub
Actions using the credentials the forward deploy already has (R2.3). Control
Tower's own AWS credentials stay read-only — it needs a `GITHUB_TOKEN`, not a
wider IAM policy. That is the whole point of routing the write through Actions,
and it should not be relaxed.

Before building it, resolve open question 10.2: does
`sls rollback --timestamp` still redeploy from the deployment bucket in
Framework v4?
