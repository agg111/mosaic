# Mosaic

Mosaic is an opinionated intelligence agent that reads your team's internal streams — Slack, email, docs, CRM — scans market trends, and delivers sharp insights to drive product decisions and strategy.

## Install

```sh
npm install -g mosaic
```

Mosaic runs on [OpenClaw](https://openclaw.ai). Make sure it's installed first.

```sh
npm install -g openclaw
openclaw plugin install mosaic
```

## Setup

Set your API keys in `~/.openclaw/.env`:

```env
HYPERSPELL_API_KEY=hs-...          # connect your team's sources at hyperspell.com
HYPERSPELL_USER_ID=your-username
TAVILY_API_KEY=tvly-...            # optional — enables web search
ANTHROPIC_API_KEY=sk-ant-...       # required for report generation
```

## Connect your sources

Sign up at [hyperspell.com](https://hyperspell.com) and connect your team's tools:

- Slack
- Gmail
- Notion / Google Drive
- HubSpot / Salesforce (coming soon)

Mosaic searches across all of them automatically.

## What Mosaic can do

| Ask Mosaic to... | It will... |
|---|---|
| Generate a market report on X | Search internal knowledge + web, synthesize, save insights |
| What do we know about our churn? | Search across Slack, email, docs |
| Research our competitors | Pull live web data + internal context |
| Remember that X is happening | Save it to memory for future reports |

## Usage

Once installed, talk to your OpenClaw agent naturally:

> "Generate a market report on AI coding tools"
> "What has the team discussed about pricing?"
> "Research the enterprise CRM space"

## Adding new capabilities

Mosaic is built to grow. To add a new tool:

1. Create `src/tools/your-tool.ts`
2. Add it to `src/tools/registry.ts`
3. Rebuild: `npm run build`

No other changes needed.

## Requirements

- Node.js 20+
- [OpenClaw](https://openclaw.ai)
- [Hyperspell](https://hyperspell.com) account
