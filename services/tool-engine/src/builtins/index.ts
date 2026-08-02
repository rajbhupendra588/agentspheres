import type { Tool } from "@agentsphere/tool-sdk";
import { aiTools } from "./ai.js";
import { browserTools } from "./browser.js";
import { coreMeshTools } from "./core-mesh.js";
import { databaseTools } from "./database.js";
import { devopsTools } from "./devops.js";
import { filesystemTools } from "./filesystem.js";
import { identityTools } from "./identity.js";
import { messagingTools } from "./messaging.js";
import { observabilityTools } from "./observability.js";
import { productivityTools } from "./productivity.js";

export const BUILTIN_TOOLS: Tool[] = [
  ...coreMeshTools,
  ...databaseTools,
  ...messagingTools,
  ...devopsTools,
  ...filesystemTools,
  ...browserTools,
  ...aiTools,
  ...observabilityTools,
  ...productivityTools,
  ...identityTools,
];

export function getBuiltinHandler(name: string): Tool | undefined {
  return BUILTIN_TOOLS.find((tool) => tool.metadata.name === name);
}
