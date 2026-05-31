import { MOSAIC_TOOLS } from "./src/tools/registry.js";
import { setConfig } from "./src/config.js";

type OpenClawPluginApi = {
  registerTool: (tool: unknown) => void;
  registerMemoryPromptSupplement?: (builder: (params: { availableTools: Set<string> }) => string[]) => void;
};

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

    api.registerMemoryPromptSupplement?.(() => [
      "## Mosaic instructions",
      "You are connected to this team's Slack channels, Notion docs, and the web via Mosaic.",
      "You have DIRECT ACCESS to internal data — do not say you need access or ask for permission.",
      "Rule: whenever a question involves team activity, a Slack channel, docs, or internal knowledge — call mosaic_search_memories FIRST with a relevant query, then answer from the results.",
      "Rule: treat Slack threads as ongoing conversations. For follow-up questions, infer the user's intent from the full thread history, especially the immediately preceding user question, Mosaic answer, and retrieved evidence. Carry forward the active business topic, entities, and channel/source being discussed when choosing the next search query.",
      "Rule: do not interpret ambiguous follow-ups as being about the current Slack channel just because the message was sent there. Prefer the thread's active topic over the container channel name.",
      "Rule: never ask clarifying questions before searching. Search immediately, then respond.",
      "Rule: if results are thin, say what you found and offer a follow-up search.",
    ]);
  },
};

export default plugin;
