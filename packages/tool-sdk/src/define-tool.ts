import type { ToolCapability, ToolCard, TenantId } from "@agentsphere/contracts";
import type {
  Tool,
  ToolActionDescriptor,
  ToolContext,
  ToolExecuteResult,
  ToolMetadata,
  ToolValidatorResult,
} from "./types.js";
import type { ToolHealth } from "@agentsphere/contracts";

export interface DefineToolOptions {
  metadata: ToolMetadata;
  capabilities?: ToolCapability[];
  actions?: ToolActionDescriptor[];
  initialize?: Tool["initialize"];
  health?: Tool["health"];
  validate?: Tool["validate"];
  execute: (ctx: ToolContext, input: unknown) => Promise<ToolExecuteResult>;
  metrics?: Tool["metrics"];
  shutdown?: Tool["shutdown"];
}

/** Primary ToolSphere SDK entry — define a production tool without class boilerplate. */
export function defineTool(options: DefineToolOptions): Tool {
  const capabilities =
    options.capabilities ??
    options.actions?.map((a) => ({
      name: a.capability,
      description: a.description,
      inputSchema: a.inputSchema,
      outputSchema: a.outputSchema,
      permissions: a.permissions ?? a.requiresPermissions,
      executionModes: a.executionModes,
    })) ??
    [
      {
        name: options.metadata.name,
        description: options.metadata.description,
        inputSchema: options.metadata.inputSchema,
        outputSchema: options.metadata.outputSchema,
        permissions: options.metadata.permissions,
        executionModes: ["SYNC" as const],
      },
    ];

  const actions: ToolActionDescriptor[] =
    options.actions ??
    capabilities.map((c) => ({
      name: c.name,
      capability: c.name,
      description: c.description,
      inputSchema: c.inputSchema,
      outputSchema: c.outputSchema,
      permissions: c.permissions,
      executionModes: c.executionModes,
    }));

  return {
    metadata: Object.freeze({ ...options.metadata }),
    capabilities: [...capabilities],
    actions: [...actions],
    initialize: options.initialize,
    health:
      options.health ??
      (async () => ({
        status: "HEALTHY" as const,
        checkedAt: new Date().toISOString(),
        message: "OK",
      })),
    validate: options.validate,
    execute: options.execute,
    metrics: options.metrics,
    shutdown: options.shutdown,
  };
}

export function toolIdFor(tenantId: string, name: string): string {
  // Stable deterministic id — matches SQL migration md5 pattern for migrated rows
  // and ULID-free lookups. Runtime registry may also assign ulids for new tools.
  return `tool_${stableHash(`${tenantId}:${name}`)}`;
}

export function toToolCard(
  tool: Tool,
  tenantId: TenantId,
  overrides?: Partial<ToolCard>,
): ToolCard {
  const meta = tool.metadata;
  return {
    id: overrides?.id ?? toolIdFor(tenantId, meta.name),
    name: meta.name,
    description: meta.description,
    version: meta.version,
    owner: meta.owner,
    category: meta.category,
    capabilities: tool.capabilities,
    authentication: meta.authentication ?? { schemes: ["NONE"], required: false },
    permissions: meta.permissions ?? [],
    configuration: meta.configuration,
    supportedProtocols: meta.supportedProtocols ?? ["INTERNAL"],
    supportedTenants: overrides?.supportedTenants,
    dependencies: meta.dependencies ?? [],
    metrics: overrides?.metrics,
    health: overrides?.health,
    rateLimits: meta.rateLimits,
    cost: meta.cost,
    documentation: meta.documentation,
    tags: meta.tags ?? [],
    regions: meta.regions ?? [],
    lifecycle: overrides?.lifecycle ?? "ACTIVE",
    builtin: meta.builtin ?? false,
    endpoint: meta.endpoint,
    inputSchema: meta.inputSchema,
    outputSchema: meta.outputSchema,
    tenantId,
    projectId: overrides?.projectId,
    rowVersion: overrides?.rowVersion,
    createdAt: overrides?.createdAt,
    updatedAt: overrides?.updatedAt,
  };
}

export async function defaultValidateJsonSchema(
  schema: Record<string, unknown> | undefined,
  input: unknown,
): Promise<ToolValidatorResult> {
  if (!schema || typeof schema !== "object") {
    return { valid: true, errors: [] };
  }
  const errors: ToolValidatorResult["errors"] = [];
  const type = schema.type;
  if (type === "object") {
    if (input === null || typeof input !== "object" || Array.isArray(input)) {
      errors.push({
        path: "$",
        code: "TYPE_MISMATCH",
        message: "Expected object input",
      });
      return { valid: false, errors };
    }
    const required = Array.isArray(schema.required)
      ? (schema.required as string[])
      : [];
    const props =
      schema.properties && typeof schema.properties === "object"
        ? (schema.properties as Record<string, unknown>)
        : {};
    const obj = input as Record<string, unknown>;
    for (const key of required) {
      if (obj[key] === undefined) {
        errors.push({
          path: key,
          code: "REQUIRED",
          message: `Missing required property "${key}"`,
        });
      }
    }
    for (const [key, value] of Object.entries(obj)) {
      const propSchema = props[key];
      if (
        propSchema &&
        typeof propSchema === "object" &&
        propSchema !== null &&
        "type" in propSchema
      ) {
        const expected = (propSchema as { type?: string }).type;
        if (expected && !matchesJsonType(value, expected)) {
          errors.push({
            path: key,
            code: "TYPE_MISMATCH",
            message: `Property "${key}" expected type ${expected}`,
          });
        }
      }
    }
  }
  return { valid: errors.length === 0, errors };
}

function matchesJsonType(value: unknown, type: string): boolean {
  switch (type) {
    case "string":
      return typeof value === "string";
    case "number":
    case "integer":
      return typeof value === "number" && (type !== "integer" || Number.isInteger(value));
    case "boolean":
      return typeof value === "boolean";
    case "object":
      return value !== null && typeof value === "object" && !Array.isArray(value);
    case "array":
      return Array.isArray(value);
    case "null":
      return value === null;
    default:
      return true;
  }
}

function stableHash(input: string): string {
  // FNV-1a 64-bit hex — deterministic, no crypto dependency
  let h = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (let i = 0; i < input.length; i++) {
    h ^= BigInt(input.charCodeAt(i));
    h = (h * prime) & 0xffffffffffffffffn;
  }
  return h.toString(16).padStart(16, "0");
}

export type { ToolHealth };
