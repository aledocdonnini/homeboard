#!/usr/bin/env bash
# Pannello acceso o spento: screen.sh on | off | auto | wake. Usato dai timer della notte e da brain.
# auto: lo stato giusto per l'ora (all'avvio della sessione: un Pi acceso di notte parte a pannello spento).
# wake: acceso adesso, e fra 2 minuti di nuovo "auto". Di notte brain lo chiama prima di parlare: con il
#       pannello spento tace anche l'audio HDMI.
set -euo pipefail
# shellcheck source=/dev/null
source "$HOME/.config/homeboard/homeboard.env"
# brain parte prima di labwc e non ha l'ambiente Wayland: si usa quello standard della sessione.
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}" WAYLAND_DISPLAY="${WAYLAND_DISPLAY:-wayland-0}"
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
  wake)
    wlr-randr --output "$output" --on
    systemctl --user stop homeboard-screen-rest.timer 2>/dev/null || true
    systemd-run --user --quiet --collect --on-active=2min --unit=homeboard-screen-rest "$0" auto
    ;;
  *) echo "uso: screen.sh on|off|auto|wake" >&2; exit 2 ;;
esac
