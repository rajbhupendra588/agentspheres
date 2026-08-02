export type {
  Tool,
  ToolContext,
  ToolMetadata,
  ToolActionDescriptor,
  ToolExecuteResult,
  ToolValidatorResult,
  ToolLifecycle,
  ToolFactory,
  RegisteredToolRuntime,
} from "./types.js";

export {
  defineTool,
  toToolCard,
  toolIdFor,
  defaultValidateJsonSchema,
} from "./define-tool.js";

export {
  Tool as ToolDecorator,
  Capability,
  ToolAction,
  RequiresAuthentication,
  RequiresPermission,
  ExecutionModes,
  readToolMetadata,
  readToolActions,
} from "./decorators.js";

export { ToolLifecycleController } from "./lifecycle.js";

export {
  ToolSdkError,
  toolNotConfigured,
  toolAuthFailed,
  toolForbidden,
  toolTimeout,
  toolCancelled,
} from "./errors.js";
