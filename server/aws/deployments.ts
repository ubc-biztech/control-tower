import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { s3 } from "./clients.js";
import { getStackResources } from "./resources.js";
import { CACHE_TTL_MS } from "../config.js";
import { cached } from "../cache.js";

export interface Deployment {
  timestamp: string;
  datetime: string;
  artifactKey: string;
  sizeBytes: number;
  current: boolean;
  git: null;
  kind: "deploy";
  actor: string | null;
  status: "succeeded";
  /** serverless-state.json sits beside the artifact and will carry the stack
   *  tags of that deploy once stamping exists. See docs/step0-findings.md. */
  stateKey: string | null;
}

/**
 * Artifacts live at serverless/{service}/{stage}/{epochMs}-{iso}/ in the
 * stack's own deployment bucket. Serverless keeps the last 5.
 */
export async function getDeployments(
  service: string,
  stage: string,
  stackName: string,
): Promise<{ deployments: Deployment[]; bucket: string | null }> {
  return cached(`deployments:${stackName}`, CACHE_TTL_MS, async () => {
    const { deploymentBucket } = await getStackResources(stackName);
    if (!deploymentBucket) return { deployments: [], bucket: null };

    const prefix = `serverless/${service}/${stage}/`;
    const objects = [];
    let token: string | undefined;
    do {
      const res = await s3.send(
        new ListObjectsV2Command({
          Bucket: deploymentBucket,
          Prefix: prefix,
          ContinuationToken: token,
        }),
      );
      objects.push(...(res.Contents ?? []));
      token = res.NextContinuationToken;
    } while (token);

    // Group by the timestamp directory; the .zip is the artifact.
    const byDir = new Map<string, { zip?: (typeof objects)[number]; state?: string }>();
    for (const o of objects) {
      if (!o.Key) continue;
      const rest = o.Key.slice(prefix.length);
      const dir = rest.split("/")[0];
      if (!dir) continue;
      const entry = byDir.get(dir) ?? {};
      if (o.Key.endsWith(".zip")) entry.zip = o;
      if (o.Key.endsWith("serverless-state.json")) entry.state = o.Key;
      byDir.set(dir, entry);
    }

    const deployments: Deployment[] = [...byDir.entries()]
      .map(([dir, entry]) => {
        const epoch = dir.split("-")[0];
        return {
          timestamp: epoch,
          datetime: new Date(Number(epoch)).toISOString(),
          artifactKey: entry.zip?.Key ?? `${prefix}${dir}/`,
          sizeBytes: entry.zip?.Size ?? 0,
          current: false,
          git: null as null,
          kind: "deploy" as const,
          actor: null,
          status: "succeeded" as const,
          stateKey: entry.state ?? null,
        };
      })
      .filter((d) => Number.isFinite(Number(d.timestamp)))
      .sort((a, b) => Number(b.timestamp) - Number(a.timestamp));

    if (deployments[0]) deployments[0].current = true;
    return { deployments, bucket: deploymentBucket };
  });
}
