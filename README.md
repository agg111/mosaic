# Mosaic

Mosaic cuts through team and market noise so you can focus on what matters. It connects to your Slack, Notion, Gmail, Drive, and market data, then answers strategy and operating questions from the context your team already has.

## Requirements

- macOS or Linux terminal
- Node.js 20+
- npm
- [OpenAI](https://platform.openai.com/api-keys) API key
- [Hyperspell](https://hyperspell.com) account and API key
- Slack workspace where you can authorize Mosaic
- Data sources connected in Hyperspell, such as Slack, Notion, Gmail, or Google Drive

## Install

```sh
npm install -g getmosaic
mosaic configure
```

`mosaic configure` walks you through setup:

- installs and configures OpenClaw
- registers the Mosaic plugin
- saves your Hyperspell API key
- saves your OpenAI API key
- optionally saves your Tavily API key for web search
- opens the Mosaic Slack connect page so you can authorize Slack

## Start

```sh
mosaic start
```

Then mention Mosaic in Slack:

```text
@Mosaic what’s happening in sales?
@Mosaic summarize recent customer feedback
@Mosaic what should we do better?
```

## Connect your sources

During `mosaic configure` you'll connect:

- **Hyperspell** — sign up at [hyperspell.com](https://hyperspell.com), then connect Slack, Notion, Gmail, and Google Drive from their dashboard
- **OpenAI** — API key from [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
- **Slack** — authorize via the connect page that opens automatically
- **Tavily** — optional web search, free key at [tavily.com](https://tavily.com)

Mosaic searches across all of them automatically.

## What Mosaic can do

| Ask Mosaic... | It will... |
|---|---|
| Generate a market report on X | Search internal knowledge + web, synthesize, save insights |
| What do we know about our churn? | Search across Slack, email, docs |
| Research our competitors | Pull live web data + internal context |
| Remember that X is happening | Save it to memory for future reports |

## Commands

```sh
mosaic configure # Set up Mosaic (run this first)
mosaic start     # Start Mosaic
mosaic stop      # Stop Mosaic
mosaic status    # Show connected channels
```

## Update

```sh
npm install -g getmosaic@latest
mosaic start
```

`mosaic start` syncs the installed OpenClaw plugin when the npm package has changed.

## Reinstall from scratch

```sh
mosaic stop
npm uninstall -g getmosaic
rm -rf ~/.openclaw/extensions/mosaic
npm install -g getmosaic
mosaic configure
mosaic start
```

## Adding new capabilities

To add a new tool:

1. Create `src/tools/your-tool.ts`
2. Add it to `src/tools/registry.ts`
3. Rebuild: `npm run build`

No other changes needed.
