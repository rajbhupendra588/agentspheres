import type {
  InvokeRequest,
  InvokeResponse,
  MemoryGetRequest,
  MemoryRecord,
  MemorySetRequest,
  ProjectId,
  TenantId,
  ToolExecuteRequest,
  ToolExecuteResponse,
} from "@agentsphere/contracts";
import {
  DEFAULT_TENANT_ID,
  InvokeRequestSchema,
  MemoryGetRequestSchema,
  MemoryRecordSchema,
  MemorySetRequestSchema,
  ToolExecuteRequestSchema,
  ToolExecuteResponseSchema,
} from "@agentsphere/contracts";
import {
  createLogger,
  httpJson,
  HttpError,
  optional,
  tenantHeaders,
  ulid,
} from "@agentsphere/common";

export interface MeshInvokeOptions {
  timeoutMs?: number;
  correlationId?: string;
  sessionId?: string;
  token?: string;
  tenantId?: TenantId;
  projectId?: ProjectId;
}

export interface MeshMemoryGetOptions {
  scope: MemoryGetRequest["scope"];
  sessionId?: string;
  agentName?: string;
  workspaceId?: string;
  token?: string;
  tenantId?: TenantId;
  projectId?: ProjectId;
}

export interface MeshMemorySetOptions extends MeshMemoryGetOptions {
  ttlSeconds?: number;
  embedding?: number[];
}

export interface MeshToolExecuteOptions {
  agentName?: string;
  correlationId?: string;
  token?: string;
}

export interface MeshClient {
  invoke(capability: string, input: unknown, opts?: MeshInvokeOptions): Promise<InvokeResponse>;
  memory: {
    get(key: string, opts: MeshMemoryGetOptions): Promise<MemoryRecord | null>;
    set(key: string, value: unknown, opts: MeshMemorySetOptions): Promise<MemoryRecord>;
  };
  tools: {
    execute(tool: string, input: unknown, opts?: MeshToolExecuteOptions): Promise<ToolExecuteResponse>;
  };
}

export interface CreateMeshClientOptions {
  agentName: string;
  tenantId?: TenantId;
  projectId?: ProjectId;
}

function authHeaders(
  token: string | undefined,
  tenantId: TenantId,
  projectId?: ProjectId,
): Record<string, string> {
  const resolved = token ?? process.env.AS_AGENT_TOKEN ?? process.env.AS_JWT_TOKEN;
  return {
    ...tenantHeaders(tenantId, projectId),
    ...(resolved ? { Authorization: `Bearer ${resolved}` } : {}),
  };
}

function resolveRuntimeBaseUrl(): string {
  const gateway = process.env.AS_GATEWAY_URL ?? process.env.AS_GATEWAY_PUBLIC_URL;
  if (gateway) {
    return `${gateway.replace(/\/$/, "")}/mesh/runtime`;
  }
  const runtime = optional("AS_RUNTIME_URL", "http://localhost:8084");
  return runtime.replace(/\/$/, "");
}

function resolveMemoryBaseUrl(): string {
  const gateway = process.env.AS_GATEWAY_URL ?? process.env.AS_GATEWAY_PUBLIC_URL;
  if (gateway) {
    return `${gateway.replace(/\/$/, "")}/mesh/memory`;
  }
  return optional("AS_MEMORY_URL", "http://localhost:8087").replace(/\/$/, "");
}

function resolveToolEngineBaseUrl(): string {
  const gateway = process.env.AS_GATEWAY_URL ?? process.env.AS_GATEWAY_PUBLIC_URL;
  if (gateway) {
    return `${gateway.replace(/\/$/, "")}/mesh/tools`;
  }
  return optional("AS_TOOL_ENGINE_URL", "http://localhost:8086").replace(/\/$/, "");
}

export function createMeshClient(
  agentNameOrOptions: string | CreateMeshClientOptions,
): MeshClient {
  const options: CreateMeshClientOptions =
    typeof agentNameOrOptions === "string"
      ? { agentName: agentNameOrOptions }
      : agentNameOrOptions;

  const agentName = options.agentName;
  const defaultTenantId = options.tenantId ?? (process.env.AS_TENANT_ID as TenantId | undefined) ?? DEFAULT_TENANT_ID;
  const defaultProjectId =
    options.projectId ?? (process.env.AS_PROJECT_ID as ProjectId | undefined) ?? undefined;

  const log = createLogger("agentsphere-sdk", { agent: agentName, tenantId: defaultTenantId });

  return {
    async invoke(capability, input, opts = {}) {
      const tenantId = opts.tenantId ?? defaultTenantId;
      const projectId = opts.projectId ?? defaultProjectId;
      const body: InvokeRequest = {
        capability,
        input,
        timeoutMs: opts.timeoutMs,
        correlationId: opts.correlationId ?? ulid(),
        sessionId: opts.sessionId,
        tenantId,
        projectId,
      };

      InvokeRequestSchema.parse(body);

      const url = `${resolveRuntimeBaseUrl()}/v1/invoke`;
      log.debug("mesh.invoke", { url, capability, tenantId, correlationId: body.correlationId });

      return httpJson<InvokeResponse>(url, {
        method: "POST",
        headers: authHeaders(opts.token, tenantId, projectId),
        body: JSON.stringify(body),
      });
    },

    memory: {
      async get(key, opts) {
        const tenantId = opts.tenantId ?? defaultTenantId;
        const projectId = opts.projectId ?? defaultProjectId;
        const query = MemoryGetRequestSchema.parse({
          key,
          scope: opts.scope,
          tenantId,
          projectId,
          sessionId: opts.sessionId,
          agentName: opts.agentName ?? agentName,
          workspaceId: opts.workspaceId,
        });

        const url = `${resolveMemoryBaseUrl()}/v1/memory/get`;
        log.debug("mesh.memory.get", { url, key, tenantId });

        try {
          const result = await httpJson<{ record: MemoryRecord }>(url, {
            method: "POST",
            headers: authHeaders(opts.token, tenantId, projectId),
            body: JSON.stringify(query),
          });
          return MemoryRecordSchema.parse(result.record);
        } catch (err) {
          if (err instanceof HttpError && err.status === 404) {
            return null;
          }
          throw err;
        }
      },

      async set(key, value, opts) {
        const tenantId = opts.tenantId ?? defaultTenantId;
        const projectId = opts.projectId ?? defaultProjectId;
        const body: MemorySetRequest = MemorySetRequestSchema.parse({
          key,
          value,
          scope: opts.scope,
          tenantId,
          projectId,
          sessionId: opts.sessionId,
          agentName: opts.agentName ?? agentName,
          workspaceId: opts.workspaceId,
          ttlSeconds: opts.ttlSeconds,
          embedding: opts.embedding,
        });

        const url = `${resolveMemoryBaseUrl()}/v1/memory`;
        log.debug("mesh.memory.set", { url, key, scope: body.scope, tenantId });

        const result = await httpJson<{ record?: MemoryRecord } & MemoryRecord>(url, {
          method: "PUT",
          headers: authHeaders(opts.token, tenantId, projectId),
          body: JSON.stringify(body),
        });

        const record = "record" in result && result.record ? result.record : result;
        return MemoryRecordSchema.parse(record);
      },
    },

    tools: {
      async execute(tool, input, opts = {}) {
        const body: ToolExecuteRequest = ToolExecuteRequestSchema.parse({
          tool,
          input,
          agentName: opts.agentName ?? agentName,
          correlationId: opts.correlationId ?? ulid(),
        });

        const url = `${resolveToolEngineBaseUrl()}/v1/execute`;
        log.debug("mesh.tools.execute", { url, tool });

        const result = await httpJson<ToolExecuteResponse>(url, {
          method: "POST",
          headers: authHeaders(opts.token, defaultTenantId, defaultProjectId),
          body: JSON.stringify(body),
        });

        return ToolExecuteResponseSchema.parse(result);
      },
    },
  };
}
