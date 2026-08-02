import type { ToolAuthScheme, ToolExecutionMode } from "@agentsphere/contracts";
import type { ToolActionDescriptor, ToolMetadata } from "./types.js";

const metaStore = new WeakMap<object, ToolMetadata>();
const actionStore = new WeakMap<object, ToolActionDescriptor[]>();

type Ctor = abstract new (...args: never[]) => unknown;

/** @Tool — class decorator declaring tool metadata. */
export function Tool(meta: ToolMetadata): ClassDecorator {
  return (target) => {
    metaStore.set(target as object, meta);
  };
}

/** @Capability — method decorator binding a capability name. */
export function Capability(name: string, description?: string): MethodDecorator {
  return (target, propertyKey) => {
    upsertAction(target, String(propertyKey), { capability: name, description });
  };
}

/** @ToolAction — method decorator naming an executable action. */
export function ToolAction(name: string): MethodDecorator {
  return (target, propertyKey) => {
    upsertAction(target, String(propertyKey), { name });
  };
}

/** @RequiresAuthentication — method decorator requiring auth schemes. */
export function RequiresAuthentication(
  ...schemes: ToolAuthScheme[]
): MethodDecorator {
  return (target, propertyKey) => {
    upsertAction(target, String(propertyKey), {
      requiresAuthentication: true,
      authSchemes: schemes.length ? schemes : ["JWT"],
    });
  };
}

/** @RequiresPermission — method decorator requiring RBAC permissions. */
export function RequiresPermission(...permissions: string[]): MethodDecorator {
  return (target, propertyKey) => {
    upsertAction(target, String(propertyKey), {
      requiresPermissions: permissions,
      permissions,
    });
  };
}

/** @ExecutionModes — declare supported execution modes on an action. */
export function ExecutionModes(...modes: ToolExecutionMode[]): MethodDecorator {
  return (target, propertyKey) => {
    upsertAction(target, String(propertyKey), { executionModes: modes });
  };
}

function upsertAction(
  target: object,
  method: string,
  patch: Partial<ToolActionDescriptor>,
): void {
  const ctor = (target as { constructor: Ctor }).constructor as object;
  const existing = actionStore.get(ctor) ?? [];
  const key = patch.name ?? method;
  const idx = existing.findIndex((a) => a.name === key || a.name === method);
  const base: ToolActionDescriptor =
    idx >= 0
      ? existing[idx]!
      : {
          name: key,
          capability: patch.capability ?? method,
        };
  const next: ToolActionDescriptor = {
    ...base,
    ...patch,
    name: patch.name ?? base.name,
    capability: patch.capability ?? base.capability,
    permissions: [...new Set([...(base.permissions ?? []), ...(patch.permissions ?? [])])],
    requiresPermissions: [
      ...new Set([...(base.requiresPermissions ?? []), ...(patch.requiresPermissions ?? [])]),
    ],
    authSchemes: patch.authSchemes ?? base.authSchemes,
    executionModes: patch.executionModes ?? base.executionModes,
  };
  if (idx >= 0) existing[idx] = next;
  else existing.push(next);
  actionStore.set(ctor, existing);
}

export function readToolMetadata(ctor: Ctor): ToolMetadata | undefined {
  return metaStore.get(ctor as object);
}

export function readToolActions(ctor: Ctor): ToolActionDescriptor[] {
  return actionStore.get(ctor as object) ?? [];
}
