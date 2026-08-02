import { ZodError } from "zod";
import type { ApiError } from "@agentsphere/contracts";

export interface ErrorResponse {
  statusCode: number;
  body: ApiError;
}

interface FastifyLikeError extends Error {
  statusCode?: number;
  code?: string;
}

function zodToDetails(error: ZodError): unknown {
  return error.flatten();
}

export function toErrorBody(err: unknown): ErrorResponse {
  if (err instanceof ZodError) {
    return {
      statusCode: 400,
      body: {
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: zodToDetails(err),
        },
      },
    };
  }

  if (err instanceof Error) {
    const fastifyErr = err as FastifyLikeError;
    const statusCode = fastifyErr.statusCode ?? 500;
    const code = fastifyErr.code ?? (statusCode >= 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR");

    // Never leak internal exception messages on 5xx responses.
    const message =
      statusCode >= 500
        ? "An unexpected error occurred"
        : fastifyErr.message || "Request failed";

    return {
      statusCode,
      body: {
        error: {
          code,
          message,
        },
      },
    };
  }

  return {
    statusCode: 500,
    body: {
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
      },
    },
  };
}
