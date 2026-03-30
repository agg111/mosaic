#!/bin/sh
# Mosaic CLI wrapper

COMMAND="${1:-help}"

case "$COMMAND" in
  start)
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
  setup)
    sh "$(dirname "$0")/../install.sh"
    ;;
  configure)
    ENV_FILE="$HOME/.openclaw/.env"
    echo ""
    echo "  Welcome to Mosaic!"
    echo ""
    echo "  Step 1 — Create a Hyperspell account and generate an API key."
    echo "  Opening https://app.hyperspell.ai/api-keys in your browser..."
    echo ""
    open "https://app.hyperspell.ai/api-keys" 2>/dev/null || xdg-open "https://app.hyperspell.ai/api-keys" 2>/dev/null || true
    echo "  Once you have your API key, paste it below."
    echo ""
    printf "  Hyperspell API key: "
    read -r HS_API_KEY
    [ -z "$HS_API_KEY" ] && echo "API key cannot be empty." && exit 1

    printf "  Your email (used as your Hyperspell user ID): "
    read -r HS_USER_ID
    [ -z "$HS_USER_ID" ] && echo "Email cannot be empty." && exit 1

    grep -v "^HYPERSPELL_API_KEY=" "$ENV_FILE" | grep -v "^HYPERSPELL_USER_ID=" > "$ENV_FILE.tmp" && mv "$ENV_FILE.tmp" "$ENV_FILE"
    echo "HYPERSPELL_API_KEY=$HS_API_KEY" >> "$ENV_FILE"
    echo "HYPERSPELL_USER_ID=$HS_USER_ID" >> "$ENV_FILE"

    echo ""
    echo "  ✓ Hyperspell connected!"
    echo ""
    echo "  Step 2 — Connect your Slack workspace."
    echo "  Opening https://connect-agg111s-projects.vercel.app in your browser..."
    echo ""
    open "https://connect-agg111s-projects.vercel.app" 2>/dev/null || xdg-open "https://connect-agg111s-projects.vercel.app" 2>/dev/null || true
    echo "  After authorizing, run the command shown on the success page, then:"
    echo ""
    echo "    mosaic start"
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
    echo "    configure Set up Hyperspell API key"
    echo "    start     Start Mosaic"
    echo "    stop      Stop Mosaic"
    echo "    status    Show connected channels and status"
    echo "    setup     Re-run setup wizard"
    echo "    plugins   List installed plugins"
    echo ""
    ;;
esac
