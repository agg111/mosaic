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

print "\nInstalling OpenClaw..."
npm install -g openclaw --silent 2>/dev/null || npm install -g openclaw --ignore-scripts --silent
success "OpenClaw $(openclaw --version 2>/dev/null | grep -o '[0-9][0-9]*\.[0-9][0-9.]*' | head -1)"

# ── 3. Install Mosaic ─────────────────────────────────────────────────────────

print "\nInstalling Mosaic..."
npm install -g mosaic --silent 2>/dev/null
openclaw plugins install mosaic 2>/dev/null || true
success "Mosaic installed"

# ── 4. API Keys ───────────────────────────────────────────────────────────────

echo ""
print "Setup"
echo ""
dim "  You'll need a Hyperspell account to connect your team's sources."
dim "  Sign up free at https://hyperspell.com"
echo ""

printf "  Hyperspell API Key: "
read -r HYPERSPELL_API_KEY
[ -z "$HYPERSPELL_API_KEY" ] && err "Hyperspell API key is required."

printf "  Hyperspell User ID: "
read -r HYPERSPELL_USER_ID
[ -z "$HYPERSPELL_USER_ID" ] && err "Hyperspell User ID is required."

echo ""
dim "  Anthropic API key for report generation — https://console.anthropic.com"
echo ""
printf "  Anthropic API Key: "
read -r ANTHROPIC_API_KEY
[ -z "$ANTHROPIC_API_KEY" ] && err "Anthropic API key is required."

echo ""
dim "  (Optional) Tavily for web search — https://tavily.com"
echo ""
printf "  Tavily API Key (enter to skip): "
read -r TAVILY_API_KEY

# ── 5. Write config ───────────────────────────────────────────────────────────

mkdir -p "$HOME/.openclaw"

# .env file
ENV_FILE="$HOME/.openclaw/.env"
cat > "$ENV_FILE" << EOF
HYPERSPELL_API_KEY=$HYPERSPELL_API_KEY
HYPERSPELL_USER_ID=$HYPERSPELL_USER_ID
ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY
EOF
[ -n "$TAVILY_API_KEY" ] && echo "TAVILY_API_KEY=$TAVILY_API_KEY" >> "$ENV_FILE"

success "Config saved to ~/.openclaw/.env"

# openclaw.json — enable Mosaic plugin with env var references
CONFIG_FILE="$HOME/.openclaw/openclaw.json"
if [ ! -f "$CONFIG_FILE" ]; then
  cat > "$CONFIG_FILE" << 'EOF'
{
  "plugins": {
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
  }
}
EOF
  success "OpenClaw config written to ~/.openclaw/openclaw.json"
else
  warn "~/.openclaw/openclaw.json already exists — add Mosaic plugin manually if needed."
fi

# ── 6. Done ───────────────────────────────────────────────────────────────────

echo ""
echo "  ╔════════════════════════════════════════╗"
echo "  ║          Mosaic is ready!              ║"
echo "  ╚════════════════════════════════════════╝"
echo ""
echo "  Next steps:"
echo ""
echo "  1. Connect your sources at https://hyperspell.com"
echo "     (Slack, Gmail, Notion, Google Drive)"
echo ""
echo "  2. Start Mosaic:"
echo ""
echo "     mosaic start"
echo ""
