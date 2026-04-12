# Mosaic

Mosaic is an opinionated intelligence agent that reads your team's internal streams — Slack, email, docs, CRM — scans market trends, and delivers sharp insights to drive product decisions and strategy.

## Install

```sh
npm install -g getmosaic
mosaic configure
```

`mosaic configure` walks you through everything — installs dependencies, connects your sources, and gets you ready to start.

## Start

```sh
mosaic start
```

## Connect your sources

During `mosaic configure` you'll connect:

- **Hyperspell** — sign up at [hyperspell.com](https://hyperspell.com), then connect Slack, Notion, Gmail, and Google Drive from their dashboard
- **Anthropic** — API key from [console.anthropic.com](https://console.anthropic.com)
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

## Adding new capabilities

To add a new tool:

1. Create `src/tools/your-tool.ts`
2. Add it to `src/tools/registry.ts`
3. Rebuild: `npm run build`

No other changes needed.

## Requirements

- Node.js 20+
- [Hyperspell](https://hyperspell.com) account
- [Anthropic](https://console.anthropic.com) API key
