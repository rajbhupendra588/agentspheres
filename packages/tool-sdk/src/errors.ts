export class ToolSdkError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly details?: unknown;

  constructor(code: string, message: string, statusCode = 400, details?: unknown) {
    super(message);
    this.name = "ToolSdkError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function toolNotConfigured(tool: string, missing: string[]): ToolSdkError {
  return new ToolSdkError(
    "TOOL_NOT_CONFIGURED",
    `Tool "${tool}" is missing required configuration: ${missing.join(", ")}`,
    424,
    { missing },
  );
}

export function toolAuthFailed(tool: string, message: string): ToolSdkError {
  return new ToolSdkError("TOOL_AUTH_FAILED", message, 401, { tool });
}

export function toolForbidden(tool: string, permission: string): ToolSdkError {
  return new ToolSdkError(
    "TOOL_FORBIDDEN",
    `Permission "${permission}" denied for tool "${tool}"`,
    403,
    { tool, permission },
  );
}

export function toolTimeout(tool: string, timeoutMs: number): ToolSdkError {
  return new ToolSdkError(
    "TOOL_TIMEOUT",
    `Tool "${tool}" exceeded timeout of ${timeoutMs}ms`,
    504,
    { tool, timeoutMs },
  );
}

export function toolCancelled(tool: string, reason?: string): ToolSdkError {
  return new ToolSdkError(
    "TOOL_CANCELLED",
    reason ?? `Tool "${tool}" execution was cancelled`,
    499,
    { tool },
  );
}
