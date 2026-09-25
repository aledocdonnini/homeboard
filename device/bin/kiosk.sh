#!/usr/bin/env bash
# Chromium a tutto schermo sulla vista TV. Lo lancia systemd (homeboard-kiosk.service) e lo rilancia se si chiude.
set -euo pipefail
# shellcheck source=/dev/null
source "$HOME/.config/homeboard/homeboard.env"

browser=$(command -v chromium || command -v chromium-browser)

# Profilo dedicato: se Chromium si chiude male, niente "Ripristinare le pagine?" al riavvio.
profile="$HOME/.local/share/homeboard-chromium"
mkdir -p "$profile"
sed -i 's/"exited_cleanly":false/"exited_cleanly":true/; s/"exit_type":"[^"]*"/"exit_type":"Normal"/' \
  "$profile/Default/Preferences" 2>/dev/null || true

exec "$browser" \
  --kiosk "$TV_URL" \
  --user-data-dir="$profile" \
  --ozone-platform=wayland \
  --noerrdialogs --disable-infobars --no-first-run --disable-session-crashed-bubble \
  --disable-features=Translate,TranslateUI \
  --autoplay-policy=no-user-gesture-required \
  --check-for-update-interval=31536000 \
  --password-store=basic \
  --remote-debugging-port=9222 --remote-debugging-address=127.0.0.1
