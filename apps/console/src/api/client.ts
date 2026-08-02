import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from "axios";
import type { ApiErrorBody } from "@/models/mesh";
import { useAuthStore } from "@/stores/auth-store";

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 300;

interface RetryableAxiosRequestConfig extends InternalAxiosRequestConfig {
  __retryCount?: number;
}

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(message: string, status: number, code: string, details?: unknown) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static fromAxios(error: AxiosError<unknown>): ApiClientError {
    const status = error.response?.status ?? 0;
    const data = error.response?.data;

    if (data && typeof data === "object" && "error" in data) {
      const body = (data as { error: ApiErrorBody }).error;
      return new ApiClientError(
        body.message,
        status || 500,
        body.code,
        body.details,
      );
    }

    if (error.code === "ECONNABORTED") {
      return new ApiClientError("Request timed out", 408, "TIMEOUT");
    }

    if (error.message === "Network Error") {
      return new ApiClientError("Network error", 0, "NETWORK_ERROR");
    }

    return new ApiClientError(
      error.message || "Request failed",
      status || 500,
      "REQUEST_FAILED",
    );
  }
}

export function resolveGatewayBaseUrl(): string {
  if (typeof window !== "undefined" && window.AGENTSPHERE_GATEWAY) {
    return window.AGENTSPHERE_GATEWAY.replace(/\/$/, "");
  }

  if (import.meta.env.DEV) {
    return "";
  }

  const envUrl = import.meta.env.VITE_GATEWAY_URL;
  if (envUrl) {
    return envUrl.replace(/\/$/, "");
  }

  return "";
}

function resolveAbsoluteGatewayUrl(path: string): string {
  const base = resolveGatewayBaseUrl();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (base) {
    return `${base}${normalizedPath}`;
  }

  if (typeof window !== "undefined") {
    return `${window.location.origin}${normalizedPath}`;
  }

  return normalizedPath;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function shouldRetry(error: AxiosError): boolean {
  if (!error.config) {
    return false;
  }

  if (error.code === "ECONNABORTED" || error.message === "Network Error") {
    return true;
  }

  const status = error.response?.status;
  return status !== undefined && status >= 500 && status < 600;
}

const axiosInstance: AxiosInstance = axios.create({
  timeout: REQUEST_TIMEOUT_MS,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

axiosInstance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const { accessToken, tenantId, projectId } = useAuthStore.getState();
  config.headers.set("x-tenant-id", tenantId);
  if (projectId) {
    config.headers.set("x-project-id", projectId);
  }
  if (accessToken) {
    config.headers.set("Authorization", `Bearer ${accessToken}`);
  }
  return config;
});

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetryableAxiosRequestConfig | undefined;

    if (!config) {
      throw ApiClientError.fromAxios(error);
    }

    const retryCount = config.__retryCount ?? 0;

    if (retryCount < MAX_RETRIES && shouldRetry(error)) {
      config.__retryCount = retryCount + 1;
      await sleep(RETRY_DELAY_MS * config.__retryCount);
      return axiosInstance.request(config);
    }

    throw ApiClientError.fromAxios(error);
  },
);

export type RequestConfig = Pick<
  AxiosRequestConfig,
  "signal" | "headers" | "params" | "timeout"
>;

async function request<T>(
  method: "get" | "post" | "put" | "delete",
  path: string,
  data?: unknown,
  config?: RequestConfig,
): Promise<T> {
  const url = resolveGatewayBaseUrl()
    ? `${resolveGatewayBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`
    : path;

  const response = await axiosInstance.request<T>({
    method,
    url,
    data,
    ...config,
  });

  return response.data;
}

export function get<T>(path: string, config?: RequestConfig): Promise<T> {
  return request<T>("get", path, undefined, config);
}

export function post<T>(
  path: string,
  body?: unknown,
  config?: RequestConfig,
): Promise<T> {
  return request<T>("post", path, body, config);
}

export function put<T>(
  path: string,
  body?: unknown,
  config?: RequestConfig,
): Promise<T> {
  return request<T>("put", path, body, config);
}

export function del<T>(path: string, config?: RequestConfig): Promise<T> {
  return request<T>("delete", path, undefined, config);
}

export { axiosInstance, resolveAbsoluteGatewayUrl };
