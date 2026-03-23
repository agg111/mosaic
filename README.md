# Mosaic

Mosaic is an opinionated intelligence agent that reads your team's internal streams — Slack, email, docs, CRM — scans market trends, and delivers sharp insights to drive product decisions and strategy.

## Install

```sh
curl -fsSL https://raw.githubusercontent.com/agg111/mosaic/main/install.sh | sh
```

That's it. The installer sets up everything and walks you through connecting your sources.

## Start

```sh
mosaic start
```

## Connect your sources

Sign up at [hyperspell.com](https://hyperspell.com) and connect your team's tools:

- Slack
- Gmail
- Notion / Google Drive
- HubSpot / Salesforce (coming soon)

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
mosaic start     # Start Mosaic
mosaic stop      # Stop Mosaic
mosaic status    # Show connected channels
mosaic setup     # Re-run setup wizard
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
