import { MOSAIC_TOOLS } from "./src/tools/registry.js";
import { setConfig } from "./src/config.js";

type OpenClawPluginApi = {
  registerTool: (tool: unknown) => void;
};

const plugin = {
  id: "mosaic",
  name: "Mosaic",
  description:
    "Market intelligence agent — distills signals from internal knowledge and the web into strategic reports",

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
    });

    for (const tool of MOSAIC_TOOLS) {
      api.registerTool(tool);
    }
  },
};

export default plugin;
