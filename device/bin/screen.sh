#!/usr/bin/env bash
# Pannello acceso o spento: screen.sh on | off | auto. Usato dai timer della notte e da wake-on-key.py.
# auto: lo stato giusto per l'ora (all'avvio della sessione: un Pi acceso di notte parte a pannello spento).
set -euo pipefail
# shellcheck source=/dev/null
source "$HOME/.config/homeboard/homeboard.env"
output="${OUTPUT:-$(wlr-randr | awk 'NR == 1 { print $1 }')}"
night() {
  local now; now=$(date +%H:%M)
  if [[ "$NIGHT_START" < "$NIGHT_END" ]]; then [[ ! "$now" < "$NIGHT_START" && "$now" < "$NIGHT_END" ]]
  else [[ ! "$now" < "$NIGHT_START" || "$now" < "$NIGHT_END" ]]; fi
}
case "${1:-}" in
  auto) if night; then wlr-randr --output "$output" --off; else wlr-randr --output "$output" --on; fi ;;
  on) wlr-randr --output "$output" --on ;;
  off) wlr-randr --output "$output" --off ;;
  *) echo "uso: screen.sh on|off|auto" >&2; exit 2 ;;
esac
