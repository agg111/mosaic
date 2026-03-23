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
    echo "    start     Start Mosaic"
    echo "    stop      Stop Mosaic"
    echo "    status    Show connected channels and status"
    echo "    setup     Re-run setup wizard"
    echo "    plugins   List installed plugins"
    echo ""
    ;;
esac
