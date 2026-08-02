const DEV_JWT_SECRET = "agentsphere-dev-secret-change-me";

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function optional(name: string, fallback: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") {
    return fallback;
  }
  return value;
}

export function envFlag(name: string, fallback = false): boolean {
  const value = process.env[name];
  if (value === undefined || value === "") {
    return fallback;
  }
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

/**
 * Resolve JWT signing secret.
 * - Locked mode (AS_GATEWAY_OPEN!=true): secret required and must not be the well-known dev default.
 * - Open/local mode: may fall back to the development secret.
 */
export function resolveJwtSecret(): string {
  const open = envFlag("AS_GATEWAY_OPEN", false);
  const secret = process.env.AS_JWT_SECRET;

  if (!secret) {
    if (open && !isProduction()) {
      return DEV_JWT_SECRET;
    }
    if (open) {
      // Docker local compose sets NODE_ENV=production but keeps gateway open.
      return DEV_JWT_SECRET;
    }
    throw new Error("AS_JWT_SECRET is required when AS_GATEWAY_OPEN is false");
  }

  if (!open && secret === DEV_JWT_SECRET) {
    throw new Error(
      "AS_JWT_SECRET must not use the development default when AS_GATEWAY_OPEN is false",
    );
  }

  if (secret.length < 32 && !open) {
    throw new Error("AS_JWT_SECRET must be at least 32 characters in locked mode");
  }

  return secret;
}

export function resolveBootstrapSecret(): string | undefined {
  const value = process.env.AS_BOOTSTRAP_SECRET;
  if (!value) {
    return undefined;
  }
  return value;
}

export { DEV_JWT_SECRET };
