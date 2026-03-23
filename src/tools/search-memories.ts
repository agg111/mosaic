import { Type } from "@sinclair/typebox";
import { getClient } from "../hyperspell.js";

export const searchMemoriesTool = {
  name: "mosaic_search_memories",
  label: "Search Internal Knowledge",
  description:
    "Search your team's connected sources (Slack, Gmail, Notion, Drive) for internal context. " +
    "Use to find what the team already knows — past discussions, decisions, emails, docs.",
  parameters: Type.Object({
    query: Type.String({ description: "Search query for internal knowledge" }),
  }),
  async execute(_id: string, params: unknown) {
    const { query } = params as { query: string };
    try {
      const client = getClient();
      const result = await client.memories.search({ query, answer: false });
      const memories = (result as any).results ?? [];
      if (memories.length === 0) {
        return { content: [{ type: "text" as const, text: "No internal results found." }] };
      }
      const text = memories
        .map((m: any) => {
          const src = m.source ?? "unknown";
          const title = m.title ? `${m.title}\n` : "";
          const snippet = (m.text ?? "").slice(0, 400);
          return `[${src}] ${title}${snippet}`;
        })
        .join("\n\n---\n\n");
      return { content: [{ type: "text" as const, text }] };
    } catch (e: any) {
      return { content: [{ type: "text" as const, text: `Memory search failed: ${e.message}` }] };
    }
  },
};
