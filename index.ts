import { MOSAIC_TOOLS } from "./src/tools/registry.js";
import { setConfig } from "./src/config.js";
import { formatMessages, formatThreadMessages, getChannelHistory, getThreadReplies } from "./src/slack.js";

type OpenClawPluginApi = {
  registerTool: (tool: unknown) => void;
  on?: (
    hookName: string,
    handler: (event: any, ctx: any) => unknown | Promise<unknown>,
    opts?: unknown
  ) => void;
  registerMemoryPromptSupplement?: (builder: (params: { availableTools: Set<string> }) => string[]) => void;
};

function normalizeSlackChannelId(channelId?: string): string | undefined {
  if (!channelId) return undefined;
  const normalized = channelId.startsWith("channel:") ? channelId.slice("channel:".length) : channelId;
  return /^[cgd][a-z0-9]+$/i.test(normalized) ? normalized.toUpperCase() : normalized;
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
}

function extractChannelId(value?: string): string | undefined {
  if (!value) return undefined;
  return value.match(/(?:channel:)?([CGD][A-Z0-9]{8,})/i)?.[1];
}

function extractThreadTs(value?: string): string | undefined {
  if (!value) return undefined;
  const match = value.match(/(?:-topic-|:thread:|topic_id["':\s]+|reply_to_id["':\s]+)(\d+\.\d+)/i);
  return match?.[1];
}

async function buildSlackConversationContext(prompt: string, ctx: any, event?: any): Promise<string | undefined> {
  const metadataText = `${JSON.stringify(ctx ?? {})}\n${JSON.stringify(event ?? {})}\n${prompt}`;
  const channelId = normalizeSlackChannelId(firstString(
    ctx?.channelId,
    ctx?.chat_id,
    ctx?.nativeChannelId,
    ctx?.NativeChannelId,
    extractChannelId(ctx?.sessionKey),
    extractChannelId(metadataText),
  ));
  const threadTs = firstString(
    ctx?.currentThreadTs,
    ctx?.threadTs,
    ctx?.replyToId,
    ctx?.reply_to_id,
    ctx?.topicId,
    ctx?.topic_id,
    extractThreadTs(ctx?.sessionKey),
    extractThreadTs(metadataText),
  );
  if (!channelId) return undefined;

  try {
    if (threadTs) {
      const messages = await getThreadReplies(channelId, threadTs, 30);
      const formatted = formatThreadMessages(messages);
      if (!formatted) return undefined;
      return [
        "## Mosaic Slack thread context",
        "This is the chronological Slack thread transcript. Treat it as conversation history for the current user request.",
        "Resolve follow-up questions from the thread's active topic, especially the root question, Mosaic's prior factual answer, and retrieved evidence.",
        "If earlier assistant replies are generic or contradict the thread's business facts, ignore those generic replies and answer from the factual thread context.",
        "Do not infer the topic from the Slack channel name when the thread has a more specific business topic.",
        "",
        formatted,
      ].join("\n");
    }

    const messages = await getChannelHistory(channelId, 30);
    const humanMessages = messages.filter((message: any) => !message.bot_id && !message.app_id && message.subtype !== "bot_message");
    const formatted = formatMessages(humanMessages);
    if (!formatted) return undefined;
    return [
      "## Mosaic Slack channel context",
      "This is recent chronological Slack channel history. Treat it as conversation history and source context for the current user request.",
      "When the user asks what is happening in this channel, answer from these recent messages first.",
      "",
      formatted,
    ].join("\n");
  } catch {
    return undefined;
  }
}

const plugin = {
  id: "mosaic",
  name: "Mosaic",
  description:
    "Less noise, more signal — for your team.",

  register(api: OpenClawPluginApi, configValues: Record<string, string> = {}) {
    setConfig({
      hyperspellApiKey:
        configValues.hyperspellApiKey ?? process.env.HYPERSPELL_API_KEY ?? "",
      hyperspellUserId:
        configValues.hyperspellUserId ?? process.env.HYPERSPELL_USER_ID ?? "",
      tavilyApiKey:
        configValues.tavilyApiKey ?? process.env.TAVILY_API_KEY,
      anthropicApiKey:
        configValues.anthropicApiKey ?? process.env.ANTHROPIC_API_KEY,
      slackBotToken:
        configValues.slackBotToken ?? process.env.SLACK_BOT_TOKEN,
    });

    for (const tool of MOSAIC_TOOLS) {
      api.registerTool(tool);
    }

    api.on?.("before_prompt_build", async (event, ctx) => {
      const conversationContext = await buildSlackConversationContext(String(event?.prompt ?? ""), ctx, event);
      return conversationContext
        ? {
            prependSystemContext:
              "For this Slack turn, use the injected chronological Mosaic Slack conversation context as conversation history. Resolve follow-up questions and channel summaries from that context before using broader memories; do not answer with generic advice when the context contains specific business facts.",
            prependContext: conversationContext,
          }
        : undefined;
    });

    api.registerMemoryPromptSupplement?.(() => [
      "## Mosaic instructions",
      "You are connected to this team's Slack channels, Notion docs, and the web via Mosaic.",
      "You have DIRECT ACCESS to internal data — do not say you need access or ask for permission.",
      "Rule: whenever a question involves team activity, a Slack channel, docs, or internal knowledge — call mosaic_search_memories FIRST with a relevant query, then answer from the results.",
      "Rule: when calling mosaic_search_memories from Slack, pass channelId from NativeChannelId or chat_id metadata and pass threadTs from ReplyToId, topic_id, or message thread metadata when available.",
      "Rule: treat Slack threads as ongoing conversations. For follow-up questions, infer the user's intent from the full thread history, especially the immediately preceding user question, Mosaic answer, and retrieved evidence. Carry forward the active business topic, entities, and channel/source being discussed when choosing the next search query.",
      "Rule: do not interpret ambiguous follow-ups as being about the current Slack channel just because the message was sent there. Prefer the thread's active topic over the container channel name.",
      "Rule: never ask clarifying questions before searching. Search immediately, then respond.",
      "Rule: if results are thin, say what you found and offer a follow-up search.",
    ]);
  },
};

export default plugin;
