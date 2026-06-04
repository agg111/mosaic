export interface MosaicConfig {
  hyperspellApiKey: string;
  hyperspellUserId: string;
  tavilyApiKey?: string;
  slackAppToken?: string;
  slackBotToken?: string;
}

let _config: MosaicConfig | null = null;

export function setConfig(config: MosaicConfig): void {
  _config = config;
}

export function getConfig(): MosaicConfig {
  if (!_config) {
    throw new Error("Mosaic: plugin not initialized. Ensure it is registered via OpenClaw.");
  }
  return _config;
}
