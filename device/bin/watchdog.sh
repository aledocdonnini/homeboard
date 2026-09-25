#!/usr/bin/env bash
# Chromium risponde ancora? Lo chiede alla porta di debug locale (solo 127.0.0.1).
# Se non risponde, o la pagina non è più la TV, riavvia il kiosk. Lo lancia un timer ogni 2 minuti.
set -uo pipefail
pages=$(curl -sf -m 10 http://127.0.0.1:9222/json/list) || {
  echo "Chromium non risponde: riavvio il kiosk"
  systemctl --user restart homeboard-kiosk.service
  exit 0
}
if ! grep -q '"url": *"[^"]*/tv' <<<"$pages"; then
  echo "La pagina non è più /tv: riavvio il kiosk"
  systemctl --user restart homeboard-kiosk.service
fi
