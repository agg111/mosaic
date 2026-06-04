import { Type } from "@sinclair/typebox";
import { getConfig } from "../config.js";
import { listJoinedChannels, matchChannels, getChannelHistory, getThreadReplies, formatMessages, formatThreadMessages } from "../slack.js";

const SEARCHABLE_SOURCES = ["slack", "notion"];
const BOT_SENDER_RE = /^(mosaic|slackbot|geekbot)$/i;
const BOT_ECHO_RE = /\b(Mosaic replies|Mosaic replied|Slackbot|was added to #|OK! I.?ve invited)\b/i;

function sanitizeMemoryText(text: string): string {
  return text
    .replace(/\bMosaic replies?[^.?!]*(?:[.?!]|$)/gi, "")
    .replace(/\bSlackbot replies?[^.?!]*(?:[.?!]|$)/gi, "")
    .trim();
}

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
        const rawText = (d.content ?? d.text ?? "").trim();
        if (BOT_SENDER_RE.test(who) || BOT_ECHO_RE.test(rawText)) return null;
        const text = sanitizeMemoryText(rawText);
        const date = d.date ? d.date.slice(0, 10) : "";
        return `${date}${who ? ` [${who}]` : ""}: ${text}`;
      })
      .filter((line: string | null): line is string => Boolean(line && line.length > 5));
    const summaries = (full.memories ?? [])
      .map((memory: string) => sanitizeMemoryText(memory))
      .filter((memory: string) => memory && !BOT_ECHO_RE.test(memory));
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

function normalizeChannelName(value: string): string {
  return value.toLowerCase().replace(/^#/, "").replace(/[^a-z0-9_-]+/g, "");
}

function extractChannelHints(query: string, threadContext: string): string[] {
  const text = `${query}\n${threadContext}`.toLowerCase();
  const hints = new Set<string>();
  const explicit = text.match(/#([a-z0-9_-]+)/g) ?? [];
  for (const match of explicit) hints.add(normalizeChannelName(match));

  const channelPhrase = text.match(/\b([a-z0-9_-]+)\s+channel\b/g) ?? [];
  for (const phrase of channelPhrase) {
    hints.add(normalizeChannelName(phrase.replace(/\s+channel$/, "")));
  }

  for (const known of ["sales", "cs", "customer-success", "support"]) {
    if (new RegExp(`\\b${known.replace("-", "[-_ ]")}\\b`).test(text)) hints.add(known);
  }

  return [...hints].filter(Boolean);
}

function resourceMatchesChannel(resource: any, hints: string[]): boolean {
  if (hints.length === 0 || resource.source !== "slack") return false;
  const candidates = [
    resource.title ?? "",
    resource.resource_id ?? "",
    resource.name ?? "",
  ].map((value) => normalizeChannelName(String(value)));
  return hints.some((hint) => candidates.some((candidate) => candidate === hint || candidate.endsWith(`_${hint}`) || candidate.endsWith(`-${hint}`)));
}

function findFocusedResources(resources: any[], query: string, threadContext: string): any[] {
  const hints = extractChannelHints(query, threadContext);
  const exact = resources
    .filter((resource) => resourceMatchesChannel(resource, hints))
    .sort((a, b) => {
      const rank = (resource: any) => {
        const candidates = [resource.title ?? "", resource.resource_id ?? "", resource.name ?? ""]
          .map((value) => normalizeChannelName(String(value)));
        const index = hints.findIndex((hint) => candidates.some((candidate) => candidate === hint || candidate.endsWith(`_${hint}`) || candidate.endsWith(`-${hint}`)));
        return index === -1 ? Number.MAX_SAFE_INTEGER : index;
      };
      return rank(a) - rank(b);
    });
  if (exact.length > 0) return exact.slice(0, 3);
  return [];
}

function buildEffectiveQuery(query: string, threadContext: string): string {
  const normalizedQuery = query.toLowerCase();
  const normalizedThread = threadContext.toLowerCase();

  // Thread context wins over the model's guessed query. In Slack follow-ups the
  // model may infer the container channel ("openclaw-hackathon") instead of the
  // business topic being discussed in the thread ("sales channel"). Correct that
  // here before we hit Hyperspell/Slack search.
  if (/\b(sales|pipeline|deal|deals|win rate|closed lost|hubspot|salesforce|arr|q2)\b/.test(normalizedThread)) {
    return "sales channel pipeline deals pricing HubSpot Salesforce ARR SLA product differentiation recommendations";
  }

  if (/\b(customer|customers|churn|onboarding|retention|support|feedback)\b/.test(normalizedThread)) {
    return "customer support onboarding churn retention feedback recommendations";
  }

  const isAmbiguousFollowUp =
    /\b(here|this|that|it|we|better|improve|improvements|done|next|fix|prioriti[sz]e)\b/.test(normalizedQuery) &&
    !/\b(sales|pipeline|deal|customer|support|product|marketing|notion|docs?)\b/.test(normalizedQuery);

  if (isAmbiguousFollowUp && threadContext.trim()) {
    return `${query} ${threadContext.slice(0, 1200)}`;
  }

  return query;
}

function buildThreadInstruction(threadContext: string, effectiveQuery: string): string {
  if (!threadContext.trim()) return "";
  return [
    "## Conversation-history instruction",
    "Answer the user's latest question using the Slack thread context first.",
    `Effective topic/query for this follow-up: ${effectiveQuery}`,
    "Do not switch to the Slack channel name or generic team advice if the thread context contains a specific topic.",
  ].join("\n");
}

async function buildFocusedHyperspellContext(query: string, threadContext: string): Promise<string | null> {
  const resources = await listResources();
  const focused = findFocusedResources(resources, query, threadContext);
  if (focused.length === 0) return null;

  const fetched = await Promise.all(
    focused.map(async (resource) => {
      const content = await fetchResourceContent(resource.source, resource.resource_id);
      const label = resource.title && resource.title !== resource.resource_id ? resource.title : resource.resource_id;
      return `## [${resource.source}] ${label}\n${content}`;
    })
  );
  return fetched.filter(Boolean).join("\n\n---\n\n") || null;
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
        const formatted = formatMessages(messages.filter((message: any) => !message.bot_id && !message.app_id && message.subtype !== "bot_message"));
        return formatted ? `## #${ch.name}\n${formatted}` : null;
      })
    );
    return results.filter(Boolean).join("\n\n---\n\n") || null;
  } catch {
    return null;
  }
}

async function fetchThreadContext(channelId?: string, threadTs?: string): Promise<string> {
  if (!channelId || !threadTs) return "";
  try {
    const messages = await getThreadReplies(channelId, threadTs, 20);
    const formatted = formatThreadMessages(messages);
    return formatted ? `## Current Slack thread context\n${formatted}` : "";
  } catch {
    return "";
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
    "For Slack thread follow-ups, pass channelId from NativeChannelId and threadTs from ReplyToId/topic_id/message thread metadata when available. " +
    "Do not search only for the literal latest words if they depend on earlier context. " +
    "When reporting results to the user, write in plain sentences with no markdown headers or bold formatting.",
  parameters: Type.Object({
    query: Type.String({ description: "What to search for in internal sources" }),
    channelId: Type.Optional(Type.String({ description: "Slack channel ID from NativeChannelId/chat metadata, for thread follow-up context" })),
    threadTs: Type.Optional(Type.String({ description: "Slack thread timestamp from ReplyToId/topic_id metadata, for thread follow-up context" })),
  }),
  async execute(_id: string, params: unknown) {
    const { query, channelId, threadTs } = params as { query: string; channelId?: string; threadTs?: string };
    const threadContext = await fetchThreadContext(channelId, threadTs);
    const effectiveQuery = buildEffectiveQuery(query, threadContext);
    const threadInstruction = buildThreadInstruction(threadContext, effectiveQuery);
    const keywords = effectiveQuery.toLowerCase().split(/\s+/).filter((w) => w.length > 2);

    try {
      const focusedHyperspell = await buildFocusedHyperspellContext(effectiveQuery, threadContext);
      if (focusedHyperspell) {
        return {
          content: [{
            type: "text" as const,
            text: [threadInstruction, threadContext, focusedHyperspell].filter(Boolean).join("\n\n---\n\n"),
          }],
        };
      }

      if (threadContext.trim()) {
        return {
          content: [{
            type: "text" as const,
            text: [threadInstruction, threadContext].filter(Boolean).join("\n\n---\n\n"),
          }],
        };
      }

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
        return { content: [{ type: "text" as const, text: [threadInstruction, threadContext, fetched.join("\n\n---\n\n")].filter(Boolean).join("\n\n---\n\n") }] };
      }

      // 3. No Hyperspell sources — fall back to direct Slack bot
      const slackText = await directSlackSearch(effectiveQuery);
      if (slackText) {
        return { content: [{ type: "text" as const, text: [threadInstruction, threadContext, slackText].filter(Boolean).join("\n\n---\n\n") }] };
      }

      return {
        content: [{
          type: "text" as const,
          text: "No Slack or Notion sources are accessible. Connect them at https://app.hyperspell.com or invite the Mosaic bot to the relevant Slack channels.",
        }],
      };
    } catch (e: any) {
      // Hyperspell unreachable — fall back to direct Slack
      const slackText = await directSlackSearch(effectiveQuery);
      if (slackText) {
        return { content: [{ type: "text" as const, text: [threadInstruction, threadContext, slackText].filter(Boolean).join("\n\n---\n\n") }] };
      }
      return { content: [{ type: "text" as const, text: `Memory search failed: ${e.message}` }] };
    }
  },
};
