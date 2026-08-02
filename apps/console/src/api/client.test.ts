import { describe, expect, it } from "vitest";
import type { AxiosError } from "axios";
import { ApiClientError, resolveGatewayBaseUrl } from "@/api/client";

describe("ApiClientError", () => {
  it("constructs with name, status, code, and details", () => {
    const err = new ApiClientError("Not found", 404, "NOT_FOUND", { id: "x" });
    expect(err.name).toBe("ApiClientError");
    expect(err.message).toBe("Not found");
    expect(err.status).toBe(404);
    expect(err.code).toBe("NOT_FOUND");
    expect(err.details).toEqual({ id: "x" });
  });

  it("fromAxios parses mesh error body", () => {
    const axiosError = {
      response: {
        status: 400,
        data: {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid input",
            details: { field: "name" },
          },
        },
      },
      message: "Request failed",
      config: {},
    } as AxiosError;

    const err = ApiClientError.fromAxios(axiosError);
    expect(err.status).toBe(400);
    expect(err.code).toBe("VALIDATION_ERROR");
    expect(err.message).toBe("Invalid input");
    expect(err.details).toEqual({ field: "name" });
  });

  it("fromAxios maps network errors", () => {
    const axiosError = {
      message: "Network Error",
      config: {},
    } as AxiosError;

    const err = ApiClientError.fromAxios(axiosError);
    expect(err.code).toBe("NETWORK_ERROR");
    expect(err.status).toBe(0);
  });
});

describe("resolveGatewayBaseUrl", () => {
  it("returns a string", () => {
    expect(typeof resolveGatewayBaseUrl()).toBe("string");
  });
});
