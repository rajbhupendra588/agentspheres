import type { Tool } from "@agentsphere/tool-sdk";
import { defineTool, toolNotConfigured, defaultValidateJsonSchema } from "@agentsphere/tool-sdk";
import { configString, request, secret, type Input } from "./_shared.js";
const inputSchema = { type: "object", properties: { realm: { type: "string" }, path: { type: "string" }, method: { type: "string" }, body: {} }, required: ["realm", "path"] };
const metadata = { name: "keycloak.admin", description: "Make an authenticated Keycloak Admin REST API request using client credentials.", version: "1.0.0", owner: "agentsphere", category: "IDENTITY" as const, builtin: true, inputSchema, tags: ["builtin", "identity", "keycloak"] };
export const identityTools: Tool[] = [defineTool({
  metadata,
  validate: (input) => defaultValidateJsonSchema(inputSchema, input),
  execute: async (ctx, input) => {
    const value = input as Input;
    const baseUrl = configString(ctx, "keycloakUrl");
    const clientId = configString(ctx, "keycloakClientId") ?? secret(ctx, "keycloakClientId");
    const clientSecret = secret(ctx, "keycloakClientSecret");
    if (!baseUrl || !clientId || !clientSecret) throw toolNotConfigured("keycloak.admin", ["keycloakUrl", "keycloakClientId", "keycloakClientSecret"]);
    const realm = encodeURIComponent(String(value.realm));
    const token = await request(`${baseUrl.replace(/\/$/, "")}/realms/${realm}/protocol/openid-connect/token`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret }) }, ctx.signal);
    const accessToken = (token.body as { access_token?: string }).access_token;
    if (!accessToken) throw new Error("Keycloak token response did not contain access_token");
    const path = String(value.path); if (!path.startsWith("/")) throw new Error("Keycloak admin path must start with /");
    const result = await request(`${baseUrl.replace(/\/$/, "")}/admin/realms/${realm}${path}`, { method: String(value.method ?? "GET"), headers: { authorization: `Bearer ${accessToken}`, ...(value.body === undefined ? {} : { "content-type": "application/json" }) }, body: value.body === undefined ? undefined : JSON.stringify(value.body) }, ctx.signal);
    return { output: result };
  },
})];
