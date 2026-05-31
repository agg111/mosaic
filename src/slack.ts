import { getConfig } from "./config.js";

interface SlackChannel {
  id: string;
  name: string;
  is_member: boolean;
}

interface SlackMessage {
  text: string;
  user?: string;
  username?: string;
  ts: string;
}

async function slackGet(endpoint: string, params: Record<string, string> = {}): Promise<any> {
  const token = getConfig().slackBotToken;
  if (!token) throw new Error("No Slack bot token configured");

  const url = new URL(`https://slack.com/api/${endpoint}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Slack API ${endpoint} failed: ${res.status}`);
  const data = await res.json() as any;
  if (!data.ok) throw new Error(`Slack API error: ${data.error ?? JSON.stringify(data)}`);
  return data;
}

export async function listJoinedChannels(): Promise<SlackChannel[]> {
  const data = await slackGet("conversations.list", {
    types: "public_channel,private_channel",
    exclude_archived: "true",
    limit: "200",
  });
  return (data.channels ?? []) as SlackChannel[];
}

export async function getChannelHistory(channelId: string, limit = 50): Promise<SlackMessage[]> {
  const data = await slackGet("conversations.history", {
    channel: channelId,
    limit: String(limit),
  });
  return (data.messages ?? []) as SlackMessage[];
}

export async function getUserName(userId: string): Promise<string> {
  try {
    const data = await slackGet("users.info", { user: userId });
    return data.user?.display_name || data.user?.real_name || userId;
  } catch {
    return userId;
  }
}

/** Find channels whose names match a query keyword. */
export function matchChannels(channels: SlackChannel[], query: string): SlackChannel[] {
  const keywords = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  const scored = channels.map((c) => {
    const name = c.name.toLowerCase();
    const score = keywords.filter((k) => name.includes(k)).length;
    return { channel: c, score };
  });
  const matched = scored.filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
  // If no keyword match, return all channels (for broad queries)
  return matched.length > 0 ? matched.slice(0, 3).map((x) => x.channel) : channels.slice(0, 3);
}

export function formatMessages(messages: SlackMessage[]): string {
  return messages
    .slice()
    .reverse()
    .map((m) => {
      const ts = new Date(Number(m.ts.split(".")[0]) * 1000).toISOString().slice(0, 16).replace("T", " ");
      const who = m.username ?? m.user ?? "unknown";
      const text = (m.text ?? "").trim();
      return text ? `${ts} [${who}]: ${text}` : null;
    })
    .filter(Boolean)
    .join("\n");
}
