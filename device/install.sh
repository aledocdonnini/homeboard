#!/usr/bin/env bash
# Installa Homeboard su un Raspberry Pi 4 con Raspberry Pi OS Lite (64 bit).
# Si lancia dalla cartella device/ copiata sul Pi, come utente normale (usa sudo dove serve).
# Si può rilanciare: non sovrascrive la configurazione e non duplica le righe già aggiunte.
set -euo pipefail

if [[ $EUID -eq 0 ]]; then
  echo "Lancialo come utente normale, non come root: userà sudo quando serve." >&2
  exit 1
fi

HERE="$(cd "$(dirname "$0")" && pwd)"
APP="$HOME/homeboard"
CONF="$HOME/.config/homeboard"
UNITS="$HOME/.config/systemd/user"
BOOT_CONFIG=/boot/firmware/config.txt
MARKER="# ——— Homeboard:"

step() { printf '\n\033[1m%s\033[0m\n' "$*"; }

step "1/8 Pacchetti: labwc, Chromium, wlr-randr, Python"
sudo apt-get update -q
browser=chromium
apt-cache show chromium >/dev/null 2>&1 || browser=chromium-browser
sudo apt-get install -y -q labwc "$browser" wlr-randr python3-venv curl

step "2/8 Script e configurazione in $APP e $CONF"
mkdir -p "$APP/bin" "$CONF" "$HOME/.config/labwc" "$UNITS"
install -m 755 "$HERE"/bin/* "$APP/bin/"
if [[ ! -f "$CONF/homeboard.env" ]]; then
  cp "$HERE/homeboard.env.example" "$CONF/homeboard.env"
  echo "Creato $CONF/homeboard.env: controlla TV_URL (l'indirizzo dell'app) prima di riavviare."
fi
# shellcheck source=/dev/null
source "$CONF/homeboard.env"

step "3/8 Voce: Piper ($PIPER_VOICE) in un ambiente Python dedicato"
[[ -x "$APP/piper-venv/bin/python" ]] || python3 -m venv "$APP/piper-venv"
"$APP/piper-venv/bin/pip" install -q --upgrade piper-tts
models="$HOME/.local/share/piper"
mkdir -p "$models"
# it_IT-paola-medium → it/it_IT/paola/medium/it_IT-paola-medium.onnx sul repository delle voci.
IFS=- read -r locale name quality <<<"$PIPER_VOICE"
base="https://huggingface.co/rhasspy/piper-voices/resolve/main/${locale%%_*}/$locale/$name/$quality/$PIPER_VOICE"
for ext in onnx onnx.json; do
  [[ -s "$models/$PIPER_VOICE.$ext" ]] || curl -fL --retry 3 -o "$models/$PIPER_VOICE.$ext" "$base.$ext"
done

step "4/8 Tasti di preselezione (gpio-key) e watchdog hardware in $BOOT_CONFIG"
if ! grep -q "$MARKER" "$BOOT_CONFIG"; then
  # shellcheck disable=SC2024 # il file si legge da utente, scrive tee con sudo: va bene così
  sudo tee -a "$BOOT_CONFIG" >/dev/null <"$HERE/config/config.txt"
fi
# Il watchdog hardware riavvia il Pi se il sistema smette di rispondere per 15 secondi.
sudo mkdir -p /etc/systemd/system.conf.d
printf '[Manager]\nRuntimeWatchdogSec=15\n' | sudo tee /etc/systemd/system.conf.d/homeboard.conf >/dev/null

step "5/8 Policy di Chromium (voce locale e autoplay per l'app)"
origin=$(sed -E 's#^(https?://[^/]+).*#\1#' <<<"$TV_URL")
sed "s#https://homeboard.vercel.app#$origin#g" "$HERE/config/chromium-policy.json" \
  | sudo install -D -m 644 /dev/stdin /etc/chromium/policies/managed/homeboard.json

step "6/8 Avvio automatico: login sulla console, poi labwc"
sudo raspi-config nonint do_boot_behaviour B2 # console, login automatico
grep -q "Homeboard: avvia labwc" "$HOME/.bash_profile" 2>/dev/null || cat "$HERE/config/bash_profile" >>"$HOME/.bash_profile"
cp "$HERE/config/labwc-autostart" "$HOME/.config/labwc/autostart"

step "7/8 Servizi systemd (utente)"
for unit in "$HERE"/systemd/*; do
  sed "s/@NIGHT_START@/$NIGHT_START/; s/@NIGHT_END@/$NIGHT_END/" "$unit" >"$UNITS/$(basename "$unit")"
done
# linger: i servizi dell'utente partono all'accensione, anche prima del login.
sudo loginctl enable-linger "$USER"
systemctl --user daemon-reload
systemctl --user enable homeboard-piper.service \
  homeboard-screen-off.timer homeboard-screen-on.timer homeboard-watchdog.timer homeboard-refresh.timer

step "8/8 Fatto"
cat <<EOF
Riavvia con: sudo reboot
Al riavvio la TV mostra un codice: abbinala dalla PWA (Casa → Abbina una TV).
Voce: curl -o /tmp/prova.wav 'http://127.0.0.1:$PIPER_PORT/?text=Ciao%2C%20sono%20Roby'
Log:  journalctl --user -u homeboard-kiosk -u homeboard-piper -f
EOF
