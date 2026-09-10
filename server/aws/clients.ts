/**
 * AWS clients.
 *
 * READ-ONLY BOUNDARY. Only Describe*, List*, Get* and FilterLogEvents commands
 * may be imported anywhere under server/. `npm run verify:readonly` fails the
 * build if a mutating command name appears. See docs/read-only.md.
 */
import { CloudFormationClient } from "@aws-sdk/client-cloudformation";
import { CloudWatchLogsClient } from "@aws-sdk/client-cloudwatch-logs";
import { S3Client } from "@aws-sdk/client-s3";
import { STSClient } from "@aws-sdk/client-sts";
import { REGION } from "../config.js";

const shared = { region: REGION, maxAttempts: 3 };

export const cloudFormation = new CloudFormationClient(shared);
export const cloudWatchLogs = new CloudWatchLogsClient(shared);
export const s3 = new S3Client(shared);
export const sts = new STSClient(shared);

export function hasCredentials() {
  return Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
}
