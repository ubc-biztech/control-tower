import { ListStackResourcesCommand } from "@aws-sdk/client-cloudformation";
import { cloudFormation } from "./clients.js";
import { cached } from "../cache.js";

/** Stack resources change rarely; cache them longer than the matrix. */
const TTL_MS = 5 * 60_000;

export interface StackResources {
  lambdaFunctionNames: string[];
  deploymentBucket: string | null;
}

export async function getStackResources(stackName: string): Promise<StackResources> {
  return cached(`resources:${stackName}`, TTL_MS, async () => {
    const summaries = [];
    let token: string | undefined;
    do {
      const res = await cloudFormation.send(
        new ListStackResourcesCommand({ StackName: stackName, NextToken: token }),
      );
      summaries.push(...(res.StackResourceSummaries ?? []));
      token = res.NextToken;
    } while (token);

    return {
      lambdaFunctionNames: summaries
        .filter((r) => r.ResourceType === "AWS::Lambda::Function" && r.PhysicalResourceId)
        .map((r) => r.PhysicalResourceId!)
        .sort(),
      deploymentBucket:
        summaries.find((r) => r.LogicalResourceId === "ServerlessDeploymentBucket")
          ?.PhysicalResourceId ?? null,
    };
  });
}
