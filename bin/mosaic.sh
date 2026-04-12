#!/bin/sh
# Mosaic CLI wrapper

MOSAIC_LINK="$(readlink "$0" 2>/dev/null)"
if [ -n "$MOSAIC_LINK" ]; then
  SYMLINK_DIR="$(cd "$(dirname "$0")" && pwd)"
  PKG_BIN="$(cd "$SYMLINK_DIR/$(dirname "$MOSAIC_LINK")" && pwd)"
else
  PKG_BIN="$(cd "$(dirname "$0")" && pwd)"
fi
PATH="$PKG_BIN:$PKG_BIN/../node_modules/.bin:$PATH"

COMMAND="${1:-help}"

_ok()   { printf "\033[32m✓\033[0m %s\n" "$1"; }
_skip() { printf "\033[2m– %s (already done)\033[0m\n" "$1"; }
_err()  { printf "\033[31m✗\033[0m %s\n" "$1"; exit 1; }
_dim()  { printf "\033[2m  %s\033[0m\n" "$1"; }

case "$COMMAND" in
  start)
    ENV_FILE="$HOME/.openclaw/.env"
    if [ ! -f "$ENV_FILE" ] || ! grep -q "HYPERSPELL_API_KEY" "$ENV_FILE"; then
      echo ""
      echo "  Mosaic isn't set up yet. Run:"
      echo ""
      echo "    mosaic configure"
      echo ""
      exit 1
    fi
    echo "Starting Mosaic..."
    openclaw gateway run
    ;;

  stop)
    openclaw gateway stop 2>/dev/null || pkill -f "openclaw gateway" 2>/dev/null || true
    echo "Mosaic stopped."
    ;;

  status)
    openclaw channels status
    ;;

  configure|setup)
    echo ""
    echo "  ┌─────────────────────────────────────┐"
    echo "  │   Mosaic — market intelligence      │"
    echo "  └─────────────────────────────────────┘"
    echo ""

    # ── 1. Node.js ──────────────────────────────────────────────────────────────
    if ! command -v node >/dev/null 2>&1; then
      _err "Node.js is required. Install it from https://nodejs.org (v20+) and re-run."
    fi
    NODE_MAJOR=$(node -e "console.log(process.versions.node.split('.')[0])")
    if [ "$NODE_MAJOR" -lt 20 ]; then
      _err "Node.js v20+ required. Found: $(node --version). Upgrade at https://nodejs.org"
    fi
    _ok "Node.js $(node --version)"

    # ── 2. OpenClaw ─────────────────────────────────────────────────────────────
    if command -v openclaw >/dev/null 2>&1; then
      _skip "OpenClaw"
    else
      echo "  Installing OpenClaw..."
      npm install -g openclaw --silent 2>/dev/null || npm install -g openclaw --ignore-scripts --silent
      _ok "OpenClaw installed"
    fi

    # ── 3. Register plugin ──────────────────────────────────────────────────────
    PLUGIN_PATH="$(npm root -g)/getmosaic"
    EXTENSIONS_DIR="$HOME/.openclaw/extensions"
    mkdir -p "$EXTENSIONS_DIR"
    # Copy only what openclaw needs — bundle.js has all deps inlined, no node_modules needed
    rm -rf "$EXTENSIONS_DIR/getmosaic"
    mkdir -p "$EXTENSIONS_DIR/getmosaic/dist"
    cp "$PLUGIN_PATH/dist/bundle.js" "$EXTENSIONS_DIR/getmosaic/dist/bundle.js"
    cp "$PLUGIN_PATH/package.json" "$EXTENSIONS_DIR/getmosaic/package.json"
    cp "$PLUGIN_PATH/openclaw.plugin.json" "$EXTENSIONS_DIR/getmosaic/openclaw.plugin.json"
    _ok "Mosaic plugin registered"

    # ── 4. Config dir ───────────────────────────────────────────────────────────
    mkdir -p "$HOME/.openclaw"
    ENV_FILE="$HOME/.openclaw/.env"
    touch "$ENV_FILE"

    # ── 5. API keys ─────────────────────────────────────────────────────────────
    if grep -q "HYPERSPELL_API_KEY" "$ENV_FILE" 2>/dev/null; then
      _skip "Hyperspell"
    else
      echo ""
      echo "  Step 1 — Hyperspell (connects Slack, Notion, Gmail, Drive)"
      _dim "Sign up free at https://hyperspell.com, then grab your API key."
      echo ""
      open "https://app.hyperspell.com/api-keys" 2>/dev/null || xdg-open "https://app.hyperspell.com/api-keys" 2>/dev/null || true
      echo ""
      printf "  Hyperspell API key: "
      stty -echo 2>/dev/null; read -r HS_KEY; stty echo 2>/dev/null; echo ""
      [ -z "$HS_KEY" ] && _err "Hyperspell API key is required."
      printf "  Your email (Hyperspell user ID): "
      read -r HS_USER
      [ -z "$HS_USER" ] && _err "Email is required."
      echo "HYPERSPELL_API_KEY=$HS_KEY" >> "$ENV_FILE"
      echo "HYPERSPELL_USER_ID=$HS_USER" >> "$ENV_FILE"
      _ok "Hyperspell connected"
    fi

    if grep -q "ANTHROPIC_API_KEY" "$ENV_FILE" 2>/dev/null; then
      _skip "Anthropic"
    else
      echo ""
      echo "  Step 2 — Anthropic API key"
      _dim "Get one at https://console.anthropic.com"
      echo ""
      printf "  Anthropic API key (sk-ant-...): "
      stty -echo 2>/dev/null; read -r ANT_KEY; stty echo 2>/dev/null; echo ""
      [ -z "$ANT_KEY" ] && _err "Anthropic API key is required."
      echo "ANTHROPIC_API_KEY=$ANT_KEY" >> "$ENV_FILE"
      _ok "Anthropic connected"
    fi

    # Write openclaw agent auth so it uses Anthropic by default
    ANT_KEY_VAL="$(grep "^ANTHROPIC_API_KEY=" "$ENV_FILE" | cut -d= -f2-)"
    AGENT_DIR="$HOME/.openclaw/agents/main/agent"
    mkdir -p "$AGENT_DIR"
    if [ ! -f "$AGENT_DIR/auth-profiles.json" ]; then
      cat > "$AGENT_DIR/auth-profiles.json" << EOF
{
  "version": 1,
  "profiles": {
    "anthropic:default": {
      "type": "api_key",
      "provider": "anthropic",
      "key": "$ANT_KEY_VAL"
    }
  }
}
EOF
      _ok "Agent configured to use Anthropic"
    fi

    if grep -q "TAVILY_API_KEY" "$ENV_FILE" 2>/dev/null; then
      _skip "Tavily"
    else
      echo ""
      echo "  Step 3 — Tavily web search (optional)"
      _dim "Get a free key at https://tavily.com"
      echo ""
      printf "  Tavily API key (press enter to skip): "
      stty -echo 2>/dev/null; read -r TAV_KEY; stty echo 2>/dev/null; echo ""
      [ -n "$TAV_KEY" ] && echo "TAVILY_API_KEY=$TAV_KEY" >> "$ENV_FILE" && _ok "Tavily connected"
    fi

    # ── 6. Slack ─────────────────────────────────────────────────────────────────
    if grep -q "SLACK_BOT_TOKEN" "$ENV_FILE" 2>/dev/null; then
      _skip "Slack"
    else
      echo ""
      echo "  Step 4 — Connect Slack"
      _dim "Authorize Mosaic in your workspace. The page will show both tokens to paste here."
      echo ""
      open "https://connect-agg111s-projects.vercel.app" 2>/dev/null || xdg-open "https://connect-agg111s-projects.vercel.app" 2>/dev/null || true
      echo ""
      printf "  Bot token (xoxb-...): "
      stty -echo 2>/dev/null; read -r SLACK_BOT; stty echo 2>/dev/null; echo ""
      [ -z "$SLACK_BOT" ] && _err "Slack bot token is required."
      printf "  App token (xapp-...): "
      stty -echo 2>/dev/null; read -r SLACK_APP; stty echo 2>/dev/null; echo ""
      [ -z "$SLACK_APP" ] && _err "Slack app token is required."
      echo "SLACK_BOT_TOKEN=$SLACK_BOT" >> "$ENV_FILE"
      echo "SLACK_APP_TOKEN=$SLACK_APP" >> "$ENV_FILE"
      _ok "Slack connected"
    fi

    # ── 7. openclaw.json — write actual values, not placeholders ─────────────────
    CONFIG_FILE="$HOME/.openclaw/openclaw.json"
    HS_KEY_VAL="$(grep "^HYPERSPELL_API_KEY=" "$ENV_FILE" | cut -d= -f2-)"
    HS_USER_VAL="$(grep "^HYPERSPELL_USER_ID=" "$ENV_FILE" | cut -d= -f2-)"
    ANT_KEY_VAL="$(grep "^ANTHROPIC_API_KEY=" "$ENV_FILE" | cut -d= -f2-)"
    TAV_KEY_VAL="$(grep "^TAVILY_API_KEY=" "$ENV_FILE" | cut -d= -f2-)"
    SLACK_BOT_VAL="$(grep "^SLACK_BOT_TOKEN=" "$ENV_FILE" | cut -d= -f2-)"
    SLACK_APP_VAL="$(grep "^SLACK_APP_TOKEN=" "$ENV_FILE" | cut -d= -f2-)"
    cat > "$CONFIG_FILE" << EOF
{
  "channels": {
    "slack": {
      "mode": "socket",
      "enabled": true,
      "botToken": "$SLACK_BOT_VAL",
      "appToken": "$SLACK_APP_VAL",
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
          "hyperspellApiKey": "$HS_KEY_VAL",
          "hyperspellUserId": "$HS_USER_VAL",
          "anthropicApiKey": "$ANT_KEY_VAL",
          "tavilyApiKey": "$TAV_KEY_VAL"
        }
      }
    }
  },
  "gateway": {
    "mode": "local"
  },
  "agents": {
    "defaults": {
      "model": "anthropic/claude-sonnet-4-6"
    }
  }
}
EOF
    _ok "Config written"

    # ── 8. Done ──────────────────────────────────────────────────────────────────
    echo ""
    echo "  ┌─────────────────────────────────────┐"
    echo "  │        Mosaic is ready!             │"
    echo "  └─────────────────────────────────────┘"
    echo ""
    echo "  Run:  mosaic start"
    echo ""
    echo "  Then @mention Mosaic in any Slack channel."
    echo ""
    ;;

  set-slack-token)
    BOT_TOKEN="${2:-}"
    [ -z "$BOT_TOKEN" ] && echo "Usage: mosaic set-slack-token <xoxb-...>" && exit 1
    ENV_FILE="$HOME/.openclaw/.env"
    grep -v "^SLACK_BOT_TOKEN=" "$ENV_FILE" > "$ENV_FILE.tmp" && mv "$ENV_FILE.tmp" "$ENV_FILE"
    echo "SLACK_BOT_TOKEN=$BOT_TOKEN" >> "$ENV_FILE"
    echo "✓ Slack token saved. Run: mosaic stop && mosaic start"
    ;;

  plugins)
    openclaw plugins list
    ;;

  *)
    echo ""
    echo "  Mosaic — market intelligence for your team"
    echo ""
    echo "  Usage: mosaic <command>"
    echo ""
    echo "  Commands:"
    echo "    configure   Set up Mosaic (run this first)"
    echo "    start       Start Mosaic"
    echo "    stop        Stop Mosaic"
    echo "    status      Show connected channels and status"
    echo "    plugins     List installed plugins"
    echo ""
    ;;
esac
