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
    # Auto-update plugin if npm version is newer than installed version
    PLUGIN_PATH="$(npm root -g)/getmosaic"
    NPM_VERSION="$(node -e "try{console.log(require('$PLUGIN_PATH/package.json').version)}catch(e){console.log('0')}")"
    INSTALLED_VERSION="$(node -e "try{console.log(require(process.env.HOME+'/.openclaw/extensions/mosaic/package.json').version)}catch(e){console.log('0')}")"
    if [ "$NPM_VERSION" != "$INSTALLED_VERSION" ] && [ "$NPM_VERSION" != "0" ]; then
      echo "Updating Mosaic plugin ($INSTALLED_VERSION → $NPM_VERSION)..."
      openclaw plugins install --force "$PLUGIN_PATH" 2>&1 | grep -v "^$" | sed 's/^/  /' || true
      openclaw plugins registry --refresh 2>&1 | tail -1 | sed 's/^/  /' || true
    fi
    echo "Starting Mosaic..."
    openclaw gateway
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
    # Clean up old manual extension copy if present
    rm -rf "$HOME/.openclaw/extensions/getmosaic" 2>/dev/null || true
    openclaw plugins install --force "$PLUGIN_PATH" 2>&1 | grep -v "^$" | sed 's/^/  /' || true
    openclaw plugins registry --refresh 2>&1 | tail -1 | sed 's/^/  /' || true
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

    if grep -q "OPENAI_API_KEY" "$ENV_FILE" 2>/dev/null; then
      _skip "OpenAI"
    else
      echo ""
      echo "  Step 2 — OpenAI API key"
      _dim "Get one at https://platform.openai.com/api-keys"
      echo ""
      open "https://platform.openai.com/api-keys" 2>/dev/null || xdg-open "https://platform.openai.com/api-keys" 2>/dev/null || true
      printf "  OpenAI API key (sk-...): "
      stty -echo 2>/dev/null; read -r OAI_KEY; stty echo 2>/dev/null; echo ""
      [ -z "$OAI_KEY" ] && _err "OpenAI API key is required."
      echo "OPENAI_API_KEY=$OAI_KEY" >> "$ENV_FILE"
      _ok "OpenAI connected"
    fi

    # Write openclaw agent auth with OpenAI key
    OAI_KEY_VAL="$(grep "^OPENAI_API_KEY=" "$ENV_FILE" | cut -d= -f2-)"
    AGENT_DIR="$HOME/.openclaw/agents/main/agent"
    mkdir -p "$AGENT_DIR"
    cat > "$AGENT_DIR/auth-profiles.json" << EOF
{
  "version": 1,
  "profiles": {
    "openai:default": {
      "type": "api_key",
      "provider": "openai",
      "key": "$OAI_KEY_VAL"
    }
  }
}
EOF
    _ok "Agent configured to use OpenAI"

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
      "streaming": {
        "mode": "partial",
        "nativeTransport": true,
        "preview": {
          "toolProgress": false
        }
      }
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
  "messages": {
    "groupChat": {
      "visibleReplies": "automatic"
    }
  },
  "agents": {
    "defaults": {
      "model": "openai/gpt-4o"
    }
  }
}
EOF
    _ok "Config written"

    # ── 8. Inject Mosaic instructions into workspace TOOLS.md ───────────────────
    TOOLS_FILE="$HOME/.openclaw/workspace/TOOLS.md"
    if [ -f "$TOOLS_FILE" ] && ! grep -q "mosaic_search_memories" "$TOOLS_FILE" 2>/dev/null; then
      cat >> "$TOOLS_FILE" << 'MOSAIC_SECTION'

## Mosaic — Internal Knowledge

You have `mosaic_search_memories` connected to this team's Slack channels and Notion docs.

**ALWAYS call `mosaic_search_memories` FIRST** when anyone asks about:
- What's happening in a channel (sales, cs, product, marketing, etc.)
- Team activity, decisions, or updates
- Internal docs, notes, or knowledge

Never say you lack access or permissions — you have direct access via the tool. Call it immediately, then answer from the results. Do not ask clarifying questions before searching.

When calling `mosaic_search_memories` from Slack, pass `channelId` from `NativeChannelId` or chat metadata and pass `threadTs` from `ReplyToId`, `topic_id`, or message thread metadata when available.

Treat Slack threads as ongoing conversations. For follow-up questions, infer the user's intent from the full thread history, especially the immediately preceding user question, Mosaic answer, and retrieved evidence. Carry forward the active business topic, entities, and channel/source being discussed when choosing the next search query.

Do not interpret ambiguous follow-ups as being about the current Slack channel just because the message was sent there. Prefer the thread's active topic over the container channel name.

MOSAIC_SECTION
      _ok "Workspace instructions updated"
    else
      _skip "Workspace instructions"
    fi

    if [ -f "$TOOLS_FILE" ] && ! grep -q "Treat Slack threads as ongoing conversations" "$TOOLS_FILE" 2>/dev/null; then
      cat >> "$TOOLS_FILE" << 'MOSAIC_FOLLOWUP_SECTION'

## Mosaic — Follow-Up Context

Treat Slack threads as ongoing conversations. For follow-up questions, infer the user's intent from the full thread history, especially the immediately preceding user question, Mosaic answer, and retrieved evidence. Carry forward the active business topic, entities, and channel/source being discussed when choosing the next search query.

Do not interpret ambiguous follow-ups as being about the current Slack channel just because the message was sent there. Prefer the thread's active topic over the container channel name.
MOSAIC_FOLLOWUP_SECTION
      _ok "Follow-up context instructions updated"
    fi

    # ── 9. Done ──────────────────────────────────────────────────────────────────
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

  set-hyperspell-key)
    HS_KEY="${2:-}"
    [ -z "$HS_KEY" ] && echo "Usage: mosaic set-hyperspell-key <hs-...>" && exit 1
    ENV_FILE="$HOME/.openclaw/.env"
    grep -v "^HYPERSPELL_API_KEY=" "$ENV_FILE" > "$ENV_FILE.tmp" && mv "$ENV_FILE.tmp" "$ENV_FILE"
    echo "HYPERSPELL_API_KEY=$HS_KEY" >> "$ENV_FILE"
    # Update openclaw.json too
    CONFIG_FILE="$HOME/.openclaw/openclaw.json"
    if [ -f "$CONFIG_FILE" ]; then
      node -e "
        const fs = require('fs');
        const cfg = JSON.parse(fs.readFileSync('$CONFIG_FILE','utf8'));
        if (cfg.plugins?.entries?.mosaic?.config) {
          cfg.plugins.entries.mosaic.config.hyperspellApiKey = '$HS_KEY';
          fs.writeFileSync('$CONFIG_FILE', JSON.stringify(cfg, null, 2));
        }
      " 2>/dev/null && echo "✓ Config updated"
    fi
    echo "✓ Hyperspell key saved. Run: mosaic stop && mosaic start"
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
    echo "    configure          Set up Mosaic (run this first)"
    echo "    start              Start Mosaic"
    echo "    stop               Stop Mosaic"
    echo "    status             Show connected channels and status"
    echo "    plugins            List installed plugins"
    echo "    set-hyperspell-key Update your Hyperspell API key"
    echo "    set-slack-token    Update your Slack bot token"
    echo ""
    ;;
esac
