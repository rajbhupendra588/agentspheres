import type { ToolDefinition } from "@agentsphere/contracts";

type ToolHandler = (input: unknown) => Promise<unknown>;

export interface BuiltinTool {
  definition: ToolDefinition;
  handler: ToolHandler;
}

export const BUILTIN_TOOLS: BuiltinTool[] = [
  {
    definition: {
      name: "echo",
      description: "Returns the tool input unchanged",
      version: "1.0.0",
      inputSchema: { type: "object" },
      outputSchema: { type: "object" },
      tags: ["builtin"],
      builtin: true,
      status: "ACTIVE",
    },
    handler: async (input) => input,
  },
  {
    definition: {
      name: "web.search",
      description: "Mock web search returning sample results",
      version: "1.0.0",
      inputSchema: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
      outputSchema: {
        type: "object",
        properties: {
          results: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                url: { type: "string" },
                snippet: { type: "string" },
              },
            },
          },
        },
      },
      tags: ["builtin", "web"],
      builtin: true,
      status: "ACTIVE",
    },
    handler: async (input) => {
      const query =
        typeof input === "object" && input !== null && "query" in input
          ? String((input as { query: unknown }).query)
          : String(input);

      return {
        results: [
          {
            title: `Result for: ${query}`,
            url: `https://example.com/search?q=${encodeURIComponent(query)}`,
            snippet: `Mock search result for "${query}"`,
          },
          {
            title: `More about ${query}`,
            url: `https://example.org/q/${encodeURIComponent(query)}`,
            snippet: `Additional mock snippet for "${query}"`,
          },
        ],
      };
    },
  },
];
