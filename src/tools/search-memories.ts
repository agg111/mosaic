import { Type } from "@sinclair/typebox";
import { getConfig } from "../config.js";
import { listJoinedChannels, matchChannels, getChannelHistory, formatMessages } from "../slack.js";

const SEARCHABLE_SOURCES = ["slack", "notion"];

// --- Direct Hyperspell REST (list + get, bypassing SDK pagination issues) ---

async function hyperspellGet(path: string): Promise<any> {
  const { hyperspellApiKey, hyperspellUserId } = getConfig();
  const res = await fetch(`https://api.hyperspell.com${path}`, {
    headers: {
      Authorization: `Bearer ${hyperspellApiKey}`,
      "X-User-Id": hyperspellUserId,
    },
  });
  if (!res.ok) throw new Error(`Hyperspell ${path} → ${res.status}`);
  return res.json();
}

async function listResources(): Promise<any[]> {
  const all: any[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < 20; i++) {
    const url = "/memories/list" + (cursor ? `?cursor=${cursor}` : "");
    const page = await hyperspellGet(url);
    const items: any[] = page.items ?? [];
    all.push(...items.filter((r: any) => SEARCHABLE_SOURCES.includes(r.source)));
    cursor = page.next_cursor ?? page.cursor;
    if (!cursor || items.length === 0) break;
  }
  return all;
}

async function fetchResourceContent(source: string, resourceId: string): Promise<string> {
  try {
    const full = await hyperspellGet(`/memories/get/${source}/${encodeURIComponent(resourceId)}`);
    const lines = (full.data ?? [])
      .slice(-60)
      .map((d: any) => {
        const who = d.sender?.name ?? "";
        const text = (d.content ?? d.text ?? "").trim();
        const date = d.date ? d.date.slice(0, 10) : "";
        return `${date}${who ? ` [${who}]` : ""}: ${text}`;
      })
      .filter((l: string) => l.length > 5);
    const summaries = (full.memories ?? []).filter(Boolean);
    return [...summaries, ...lines].join("\n") || "(empty)";
  } catch (e: any) {
    return `(fetch failed: ${e.message})`;
  }
}

function scoreResource(resource: any, keywords: string[]): number {
  if (keywords.length === 0) return 1;
  const haystack = `${resource.title ?? ""} ${resource.resource_id ?? ""}`.toLowerCase();
  return keywords.filter((k) => haystack.includes(k)).length / keywords.length;
}

// --- Direct Slack API fallback ---

async function directSlackSearch(query: string): Promise<string | null> {
  try {
    const { slackBotToken } = getConfig();
    if (!slackBotToken) return null;
    const channels = await listJoinedChannels();
    if (channels.length === 0) return null;
    const matched = matchChannels(channels, query);
    const results = await Promise.all(
      matched.map(async (ch) => {
        const messages = await getChannelHistory(ch.id, 40);
        const formatted = formatMessages(messages);
        return formatted ? `## #${ch.name}\n${formatted}` : null;
      })
    );
    return results.filter(Boolean).join("\n\n---\n\n") || null;
  } catch {
    return null;
  }
}

// --- Tool ---

export const searchMemoriesTool = {
  name: "mosaic_search_memories",
  label: "Search Internal Knowledge",
  description:
    "Read from the team's connected Slack channels and Notion docs. " +
    "Call this whenever someone asks about team activity, a specific channel, decisions, or internal knowledge. " +
    "You have direct access — use it immediately without asking for permission. " +
    "For follow-up questions, form the query from the full thread context: prior user asks, prior Mosaic answers, retrieved evidence, active business topic, and source/channel under discussion. " +
    "Do not search only for the literal latest words if they depend on earlier context. " +
    "When reporting results to the user, write in plain sentences with no markdown headers or bold formatting.",
  parameters: Type.Object({
    query: Type.String({ description: "What to search for in internal sources" }),
  }),
  async execute(_id: string, params: unknown) {
    const { query } = params as { query: string };
    const keywords = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);

    try {
      // 1. Fetch channels by keyword match via Hyperspell list + get
      //    (semantic search requires elevated API key permissions — using direct fetch for now)
      const allResources = await listResources();
      if (allResources.length > 0) {
        const ranked = allResources
          .map((r) => ({ resource: r, score: scoreResource(r, keywords) }))
          .sort((a, b) => b.score - a.score);
        const top = ranked.slice(0, 5).map((x) => x.resource);
        const fetched = await Promise.all(
          top.map(async (r) => {
            const content = await fetchResourceContent(r.source, r.resource_id);
            const label = r.title && r.title !== r.resource_id ? r.title : r.resource_id;
            return `## [${r.source}] ${label}\n${content}`;
          })
        );
        return { content: [{ type: "text" as const, text: fetched.join("\n\n---\n\n") }] };
      }

      // 3. No Hyperspell sources — fall back to direct Slack bot
      const slackText = await directSlackSearch(query);
      if (slackText) {
        return { content: [{ type: "text" as const, text: slackText }] };
      }

      return {
        content: [{
          type: "text" as const,
          text: "No Slack or Notion sources are accessible. Connect them at https://app.hyperspell.com or invite the Mosaic bot to the relevant Slack channels.",
        }],
      };
    } catch (e: any) {
      // Hyperspell unreachable — fall back to direct Slack
      const slackText = await directSlackSearch(query);
      if (slackText) {
        return { content: [{ type: "text" as const, text: slackText }] };
      }
      return { content: [{ type: "text" as const, text: `Memory search failed: ${e.message}` }] };
    }
  },
};
