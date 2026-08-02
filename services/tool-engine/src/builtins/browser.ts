import type { Tool } from "@agentsphere/tool-sdk";
import { defineTool, defaultValidateJsonSchema } from "@agentsphere/tool-sdk";

const fetchSchema = {
  type: "object",
  properties: { url: { type: "string" } },
  required: ["url"],
};

const searchSchema = {
  type: "object",
  properties: { query: { type: "string" } },
  required: ["query"],
};

async function readBoundedBody(
  response: Response,
  maxBytes: number,
  signal: AbortSignal,
): Promise<string> {
  const reader = response.body?.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  while (reader) {
    if (signal.aborted) throw new Error("Aborted");
    const next = await reader.read();
    if (next.done) break;
    bytes += next.value.byteLength;
    if (bytes > maxBytes) {
      await reader.cancel();
      throw new Error(`Response body exceeds ${maxBytes} byte limit`);
    }
    chunks.push(next.value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

export const browserTools: Tool[] = [
  defineTool({
    metadata: {
      name: "browser.fetch",
      description: "Fetch a URL over HTTP GET and return a bounded response body.",
      version: "1.0.0",
      owner: "agentsphere",
      category: "BROWSER",
      builtin: true,
      inputSchema: fetchSchema,
      tags: ["builtin", "browser", "http"],
    },
    validate: (input) => defaultValidateJsonSchema(fetchSchema, input),
    execute: async (ctx, input) => {
      const url = String((input as Record<string, unknown>).url);
      const response = await fetch(url, { method: "GET", signal: ctx.signal });
      const body = await readBoundedBody(response, 1_048_576, ctx.signal);
      const headers = ["content-type", "content-length", "last-modified", "etag"].reduce<
        Record<string, string>
      >((result, key) => {
        const value = response.headers.get(key);
        if (value) result[key] = value;
        return result;
      }, {});
      return {
        output: { status: response.status, ok: response.ok, headers, body },
      };
    },
  }),
  defineTool({
    metadata: {
      name: "web.search",
      description:
        "Search the public web via DuckDuckGo Instant Answer API and return structured results.",
      version: "1.0.0",
      owner: "agentsphere",
      category: "BROWSER",
      builtin: true,
      inputSchema: searchSchema,
      tags: ["builtin", "browser", "search"],
    },
    validate: (input) => defaultValidateJsonSchema(searchSchema, input),
    execute: async (ctx, input) => {
      const query = String((input as Record<string, unknown>).query);
      const endpoint = new URL("https://api.duckduckgo.com/");
      endpoint.searchParams.set("q", query);
      endpoint.searchParams.set("format", "json");
      endpoint.searchParams.set("no_html", "1");
      endpoint.searchParams.set("skip_disambig", "1");

      const response = await fetch(endpoint, {
        method: "GET",
        headers: { accept: "application/json" },
        signal: ctx.signal,
      });
      if (!response.ok) {
        throw Object.assign(
          new Error(`DuckDuckGo search failed with HTTP ${response.status}`),
          { code: "WEB_SEARCH_FAILED", statusCode: 502 },
        );
      }
      const payload = (await response.json()) as {
        AbstractText?: string;
        AbstractURL?: string;
        Heading?: string;
        RelatedTopics?: Array<{ Text?: string; FirstURL?: string; Topics?: unknown[] }>;
        Results?: Array<{ Text?: string; FirstURL?: string }>;
      };

      const results: Array<{ title: string; url: string; snippet: string }> = [];
      if (payload.AbstractText && payload.AbstractURL) {
        results.push({
          title: payload.Heading || query,
          url: payload.AbstractURL,
          snippet: payload.AbstractText,
        });
      }
      for (const item of payload.Results ?? []) {
        if (item.Text && item.FirstURL) {
          results.push({ title: item.Text, url: item.FirstURL, snippet: item.Text });
        }
      }
      for (const topic of payload.RelatedTopics ?? []) {
        if (topic.Text && topic.FirstURL) {
          results.push({ title: topic.Text, url: topic.FirstURL, snippet: topic.Text });
        }
        if (results.length >= 8) break;
      }

      return { output: { query, results, provider: "duckduckgo" } };
    },
  }),
];
