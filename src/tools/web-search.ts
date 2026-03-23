import { Type } from "@sinclair/typebox";
import { getConfig } from "../config.js";

export const webSearchTool = {
  name: "mosaic_web_search",
  label: "Web Search",
  description:
    "Search the web for current market trends, competitor news, industry data, and recent developments.",
  parameters: Type.Object({
    query: Type.String({ description: "Web search query for market trends and news" }),
  }),
  async execute(_id: string, params: unknown) {
    const { query } = params as { query: string };
    const { tavilyApiKey } = getConfig();

    if (!tavilyApiKey) {
      return {
        content: [
          {
            type: "text" as const,
            text: "Web search is not configured. Add a Tavily API key to enable it.",
          },
        ],
      };
    }

    try {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: tavilyApiKey,
          query,
          max_results: 5,
          include_answer: true,
        }),
      });
      const data = (await res.json()) as any;
      const lines: string[] = [];
      if (data.answer) lines.push(`${data.answer}\n`);
      for (const r of data.results ?? []) {
        lines.push(`• ${r.title}\n  ${r.url}\n  ${(r.content ?? "").slice(0, 250)}`);
      }
      return { content: [{ type: "text" as const, text: lines.join("\n\n") || "No results." }] };
    } catch (e: any) {
      return { content: [{ type: "text" as const, text: `Web search failed: ${e.message}` }] };
    }
  },
};
