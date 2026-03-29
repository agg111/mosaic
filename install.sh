#!/bin/sh
set -e

# Colors
BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
DIM='\033[2m'
NC='\033[0m'

print()   { printf "${BOLD}%s${NC}\n" "$1"; }
success() { printf "${GREEN}✓${NC} %s\n" "$1"; }
warn()    { printf "${YELLOW}!${NC} %s\n" "$1"; }
err()     { printf "${RED}✗${NC} %s\n" "$1"; exit 1; }
dim()     { printf "${DIM}%s${NC}\n" "$1"; }
skip()    { printf "${DIM}– %s (already set up)${NC}\n" "$1"; }

echo ""
echo "  ╔════════════════════════════════════════╗"
echo "  ║              Mosaic                    ║"
echo "  ║   Market intelligence for your team    ║"
echo "  ╚════════════════════════════════════════╝"
echo ""

# ── 1. Check Node.js ──────────────────────────────────────────────────────────

if ! command -v node >/dev/null 2>&1; then
  err "Node.js is required. Install it from https://nodejs.org (v20+) and re-run."
fi

NODE_MAJOR=$(node -e "console.log(process.versions.node.split('.')[0])")
if [ "$NODE_MAJOR" -lt 20 ]; then
  err "Node.js v20+ required. Found: $(node --version). Upgrade at https://nodejs.org"
fi

success "Node.js $(node --version)"

# ── 2. Install OpenClaw ───────────────────────────────────────────────────────

if command -v openclaw >/dev/null 2>&1; then
  skip "OpenClaw"
else
  print "\nInstalling OpenClaw..."
  npm install -g openclaw --silent 2>/dev/null || npm install -g openclaw --ignore-scripts --silent
  success "OpenClaw installed"
fi

# ── 3. Install Mosaic ─────────────────────────────────────────────────────────

if command -v mosaic >/dev/null 2>&1 && openclaw plugins list 2>/dev/null | grep -q "mosaic"; then
  skip "Mosaic"
else
  print "\nInstalling Mosaic..."
  npm install -g getmosaic --silent 2>/dev/null || npm install -g getmosaic --ignore-scripts --silent
  PLUGIN_PATH="$(npm root -g)/getmosaic"
  openclaw plugins install "$PLUGIN_PATH" 2>/dev/null || true
  success "Mosaic installed"
fi

# ── 4. API Keys ───────────────────────────────────────────────────────────────

ENV_FILE="$HOME/.openclaw/.env"
mkdir -p "$HOME/.openclaw"

if [ -f "$ENV_FILE" ] && grep -q "HYPERSPELL_API_KEY" "$ENV_FILE"; then
  skip "API keys"
else
  echo ""
  print "Connect your sources"
  echo ""
  dim "  Hyperspell connects your Slack, Notion, Gmail, and Drive."
  dim "  Sign up free at https://hyperspell.com, then grab your API key."
  echo ""

  printf "  Hyperspell API Key: "
  read -r HYPERSPELL_API_KEY
  [ -z "$HYPERSPELL_API_KEY" ] && err "Hyperspell API key is required."

  printf "  Hyperspell User ID: "
  read -r HYPERSPELL_USER_ID
  [ -z "$HYPERSPELL_USER_ID" ] && err "Hyperspell User ID is required."

  echo ""
  dim "  Anthropic API key — https://console.anthropic.com"
  echo ""
  printf "  Anthropic API Key: "
  read -r ANTHROPIC_API_KEY
  [ -z "$ANTHROPIC_API_KEY" ] && err "Anthropic API key is required."

  echo ""
  dim "  (Optional) Tavily for web search — https://tavily.com"
  echo ""
  printf "  Tavily API Key (enter to skip): "
  read -r TAVILY_API_KEY

  cat > "$ENV_FILE" << EOF
HYPERSPELL_API_KEY=$HYPERSPELL_API_KEY
HYPERSPELL_USER_ID=$HYPERSPELL_USER_ID
ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY
EOF
  [ -n "$TAVILY_API_KEY" ] && echo "TAVILY_API_KEY=$TAVILY_API_KEY" >> "$ENV_FILE"
  success "API keys saved"
fi

# ── 5. Slack ──────────────────────────────────────────────────────────────────

if [ -f "$ENV_FILE" ] && grep -q "SLACK_BOT_TOKEN" "$ENV_FILE"; then
  skip "Slack"
else
  echo ""
  print "Connect Slack"
  echo ""
  dim "  Create a Slack app at https://api.slack.com/apps"
  dim "  Need: Bot Token (xoxb-...) and App-Level Token (xapp-...)"
  dim "  See setup guide: https://github.com/agg111/mosaic#slack-setup"
  echo ""

  printf "  Slack Bot Token (xoxb-...): "
  read -r SLACK_BOT_TOKEN
  [ -z "$SLACK_BOT_TOKEN" ] && err "Slack bot token is required."

  printf "  Slack App Token (xapp-...): "
  read -r SLACK_APP_TOKEN
  [ -z "$SLACK_APP_TOKEN" ] && err "Slack app token is required."

  cat >> "$ENV_FILE" << EOF
SLACK_BOT_TOKEN=$SLACK_BOT_TOKEN
SLACK_APP_TOKEN=$SLACK_APP_TOKEN
EOF
  success "Slack tokens saved"
fi

# ── 6. Write openclaw.json ────────────────────────────────────────────────────

CONFIG_FILE="$HOME/.openclaw/openclaw.json"
if [ -f "$CONFIG_FILE" ]; then
  skip "OpenClaw config"
else
  cat > "$CONFIG_FILE" << 'EOF'
{
  "channels": {
    "slack": {
      "mode": "socket",
      "enabled": true,
      "botToken": "${SLACK_BOT_TOKEN}",
      "appToken": "${SLACK_APP_TOKEN}",
      "groupPolicy": "open",
      "dmPolicy": "open",
      "allowFrom": ["*"],
      "nativeStreaming": true,
      "streaming": "partial"
    }
  },
  "plugins": {
    "allow": ["mosaic"],
    "entries": {
      "mosaic": {
        "enabled": true,
        "config": {
          "hyperspellApiKey": "${HYPERSPELL_API_KEY}",
          "hyperspellUserId": "${HYPERSPELL_USER_ID}",
          "anthropicApiKey": "${ANTHROPIC_API_KEY}",
          "tavilyApiKey": "${TAVILY_API_KEY}"
        }
      }
    }
  },
  "gateway": {
    "mode": "local"
  }
}
EOF
  success "OpenClaw config written"
fi

openclaw config set gateway.mode local >/dev/null 2>&1 || true

# ── 7. Done ───────────────────────────────────────────────────────────────────

echo ""
echo "  ╔════════════════════════════════════════╗"
echo "  ║          Mosaic is ready!              ║"
echo "  ╚════════════════════════════════════════╝"
echo ""
echo "  Next steps:"
echo ""
echo "  1. Connect your sources at https://hyperspell.com"
echo "     (Slack, Notion, Gmail, Google Drive)"
echo ""
echo "  2. Start Mosaic:"
echo ""
echo "     mosaic start"
echo ""
echo "  Then @mention Mosaic in any Slack channel."
echo ""
