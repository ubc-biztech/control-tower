/** Plausible BizTech commit messages / actors, so the matrix reads like the real repo. */

export const COMMIT_MESSAGES = [
  "Enable bizwall snapshot pagination (#781)",
  "Connections + onboarding flow (#762)",
  "centralize year gating and secure profile completion",
  "fix: registration partner batch off-by-one on waitlist",
  "chore(deps): bump aws-sdk clients to v3.658",
  "feat(btx): market snapshot caching, 30s TTL",
  "hotfix: stripe webhook signature verification",
  "add feedback form submissions endpoint (#755)",
  "refactor: extract shared dynamo helpers into lib/",
  "fix(qr): scan idempotency key collision on double-tap",
  "feat(quests): kiosk mode for BluePrint check-in",
  "bump node runtime to 22 across services",
  "fix: cognito authorizer 401 on refreshed tokens",
  "feat(emails): sendgrid template versioning",
  "revert \"enable partner self-serve membership\"",
  "chore: prune unused IAM statements from events",
  "fix(teams): normalized round scores when judge skips",
  "feat(instagram): surface token expiry in analytics payload",
  "perf: batch getItem for leaderboard reads",
  "fix: CORS preflight on api-dev subdomain",
  "feat(stickers): websocket reconnect backoff",
  "chore: tighten registration schema validation",
  "fix(payments): cancel webhook double-refund guard",
  "feat(profiles): profile pic upload presigned URLs",
];

export const ACTORS = [
  "github-actions",
  "github-actions",
  "github-actions",
  "isaacliu",
  "dev-lead",
  "biztech-ci",
];

export const BRANCHES: Record<string, string> = {
  dev: "dev",
  staging: "master",
  prod: "master",
};

/** Log line templates keyed loosely by function shape. */
export const LOG_TEMPLATES = [
  { level: "INFO" as const, t: "Received {method} {path} requestId={rid}" },
  { level: "INFO" as const, t: "dynamodb:Query table=biztechTable{stage} items={n} ms={ms}" },
  { level: "INFO" as const, t: "authorizer ok sub={sub} email={email}" },
  { level: "INFO" as const, t: "response 200 bytes={bytes} ms={ms}" },
  { level: "WARN" as const, t: "conditional check failed, retrying attempt={a}/3" },
  { level: "WARN" as const, t: "cold start detected initMs={ms}" },
  { level: "ERROR" as const, t: "ValidationException: One or more parameter values were invalid" },
  { level: "ERROR" as const, t: "ProvisionedThroughputExceededException on table biztechTable{stage}" },
  { level: "ERROR" as const, t: "TypeError: Cannot read properties of undefined (reading 'id')" },
  { level: "INFO" as const, t: "cache hit key={rid} ttl={ms}ms" },
  { level: "INFO" as const, t: "publishing to eventbridge detailType=registration.updated" },
];

export const HTTP_METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH"];
