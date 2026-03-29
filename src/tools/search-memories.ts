import { Type } from "@sinclair/typebox";
import { getClient } from "../hyperspell.js";

async function fetchAllWithContent(client: any): Promise<any[]> {
  const items: any[] = [];
  let cursor: string | undefined;
  do {
    const r = await client.memories.list({ limit: 100, cursor });
    const page = r.body?.items ?? r.items ?? [];
    for (const item of page) {
      try {
        const full = await client.memories.get(item.resource_id, { source: item.source });
        const text = (full.data ?? []).map((d: any) => d.text ?? "").join("\n").trim();
        const memory = (full.memories ?? []).join(" ").trim();
        items.push({ source: item.source, title: item.title, text: text || memory });
      } catch {
        items.push({ source: item.source, title: item.title, text: "" });
      }
    }
    cursor = r.body?.next_cursor ?? r.next_cursor;
    if (!cursor || page.length === 0) break;
  } while (true);
  return items;
}

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

      // Try semantic search first
      const result = await client.memories.search({ query, answer: false });
      const documents = (result as any).documents ?? (result as any).results ?? [];

      if (documents.length > 0) {
        const text = documents
          .map((m: any) => {
            const src = m.source ?? "unknown";
            const title = m.title ? `${m.title}\n` : "";
            const snippet = (m.text ?? m.content ?? "").slice(0, 400);
            return `[${src}] ${title}${snippet}`;
          })
          .join("\n\n---\n\n");
        return { content: [{ type: "text" as const, text }] };
      }

      // Fallback: fetch all memories and do keyword match
      console.log(`[mosaic] search API returned 0 results for "${query}", falling back to full fetch`);
      const allItems = await fetchAllWithContent(client);
      if (allItems.length === 0) {
        return { content: [{ type: "text" as const, text: "No internal sources connected yet." }] };
      }

      const q = query.toLowerCase();
      const matched = allItems.filter(
        (m) => m.title?.toLowerCase().includes(q) || m.text?.toLowerCase().includes(q)
      );
      const results = matched.length > 0 ? matched : allItems; // if no keyword match, return all

      const text = results
        .map((m) => {
          const snippet = (m.text ?? "").slice(0, 600);
          return `[${m.source}] ${m.title}\n${snippet}`;
        })
        .join("\n\n---\n\n");

      return { content: [{ type: "text" as const, text }] };
    } catch (e: any) {
      return { content: [{ type: "text" as const, text: `Memory search failed: ${e.message}` }] };
    }
  },
};
