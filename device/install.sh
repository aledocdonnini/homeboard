#!/usr/bin/env bash
# Installa Roby, la postazione di casa, su un Raspberry Pi 5 con Raspberry Pi OS Lite (64 bit, Bookworm).
# Si lancia dal clone del repository, come utente normale (usa sudo dove serve):
#   git clone https://github.com/aledocdonnini/homeboard ~/homeboard && ~/homeboard/device/install.sh
#   device/install.sh           tutto: pacchetti, avvio automatico, config.txt, audio, dipendenze, servizi
#   device/install.sh --update  solo dipendenze, modelli e servizi (lo usa bin/update.sh dopo un git pull)
#   device/install.sh --solo deps units   solo i passi indicati: system, config, node, deps, units
# Si può rilanciare: non sovrascrive la configurazione e non duplica le righe già aggiunte.
set -euo pipefail

if [[ $EUID -eq 0 ]]; then
  echo "Lancialo come utente normale, non come root: userà sudo quando serve." >&2
  exit 1
fi

REPO="$(cd "$(dirname "$0")/.." && pwd)"
HERE="$REPO/device"
CONF="$HOME/.config/homeboard"
ENVFILE="$CONF/homeboard.env"
UNITS="$HOME/.config/systemd/user"
NODE_HOME="$HOME/.local/node"
VENV="$REPO/.venv-voice"
BOOT_CONFIG=/boot/firmware/config.txt
MARKER="# ——— Homeboard:"
UPDATE_ONLY=false
[[ "${1:-}" == "--update" ]] && UPDATE_ONLY=true

step() { printf '\n\033[1m%s\033[0m\n' "$*"; }

if [[ "$REPO" != "$HOME/homeboard" ]]; then
  echo "Il repository deve stare in ~/homeboard (i servizi lo cercano lì), non in $REPO." >&2
  exit 1
fi

# ——— Sistema: una volta sola ———————————————————————————————————————————————————————

system() {
  step "Pacchetti: labwc, Chromium, wlr-randr, Python, audio"
  sudo apt-get update -q
  local browser=chromium
  apt-cache show chromium >/dev/null 2>&1 || browser=chromium-browser
  sudo apt-get install -y -q labwc "$browser" wlr-randr git curl xz-utils \
    python3-venv python3-dev libportaudio2 libatomic1 alsa-utils

  step "Configurazione in $CONF"
  mkdir -p "$CONF" "$HOME/.config/labwc" "$UNITS"
  if [[ ! -f "$ENVFILE" ]]; then
    cp "$HERE/homeboard.env.example" "$ENVFILE"
    chmod 600 "$ENVFILE"
    echo "Creato $ENVFILE: metti URL e chiave pubblica di Supabase e controlla TV_URL prima di riavviare."
  fi

  step "Tasti (gpio-key) e watchdog hardware in $BOOT_CONFIG"
  if grep -q "$MARKER" "$BOOT_CONFIG"; then
    # Già aggiunto (anche dalla vecchia versione a sei tasti): si sostituisce il blocco intero.
    sudo sed -i "/$MARKER da aggiungere/,/fine Homeboard/d" "$BOOT_CONFIG"
  fi
  # shellcheck disable=SC2024 # il file si legge da utente, scrive tee con sudo: va bene così
  sudo tee -a "$BOOT_CONFIG" >/dev/null <"$HERE/config/config.txt"
  sudo mkdir -p /etc/systemd/system.conf.d
  printf '[Manager]\nRuntimeWatchdogSec=15\n' | sudo tee /etc/systemd/system.conf.d/homeboard.conf >/dev/null

  step "Avvio automatico: login sulla console, poi labwc"
  sudo raspi-config nonint do_boot_behaviour B2 # console, login automatico
  grep -q "Homeboard: avvia labwc" "$HOME/.bash_profile" 2>/dev/null || cat "$HERE/config/bash_profile" >>"$HOME/.bash_profile"
  cp "$HERE/config/labwc-autostart" "$HOME/.config/labwc/autostart"
  # linger: i servizi dell'utente (brain, voice) partono all'accensione, anche prima del login.
  sudo loginctl enable-linger "$USER"
  # audio: la scheda HDMI e il microfono; input: i tasti gpio-key.
  sudo usermod -aG audio,input "$USER"
}

# ——— Ogni volta (anche dopo un aggiornamento) ————————————————————————————————————————

config() {
  # shellcheck source=/dev/null
  source "$ENVFILE"
  step "Policy di Chromium per $TV_URL (accesso a brain su 127.0.0.1)"
  local origin
  origin=$(sed -E 's#^(https?://[^/]+).*#\1#' <<<"$TV_URL")
  sed "s#https://homeboard-puce.vercel.app#$origin#g" "$HERE/config/chromium-policy.json" \
    | sudo install -D -m 644 /dev/stdin /etc/chromium/policies/managed/homeboard.json

  step "Audio: uscita HDMI ($HDMI_CARD), microfono USB"
  local mic="${MIC_CARD:-}"
  if [[ -z "$mic" ]]; then
    # La prima scheda che registra (l'HDMI no): di solito è il microfono USB.
    mic=$(arecord -l 2>/dev/null | sed -n 's/^card [0-9]*: \([^ ]*\) .*/\1/p' | head -1 || true)
  fi
  if [[ -z "$mic" ]]; then
    echo "Nessun microfono trovato: collegalo e rilancia (o imposta MIC_CARD). Per ora ~/.asoundrc resta com'è."
  else
    sed "s/@HDMI_CARD@/$HDMI_CARD/g; s/@MIC_CARD@/$mic/g" "$HERE/config/asoundrc" >"$HOME/.asoundrc"
    echo "Microfono: $mic."
  fi
}

install_node() {
  step "Node 22 in $NODE_HOME (per brain)"
  local base=https://nodejs.org/dist/latest-v22.x sums file
  sums=$(curl -fsSL "$base/SHASUMS256.txt")
  file=$(awk '/linux-arm64\.tar\.xz$/ { print $2 }' <<<"$sums")
  local version="${file%-linux-arm64.tar.xz}"
  if [[ -x "$NODE_HOME/bin/node" && "$("$NODE_HOME/bin/node" --version)" == "${version#node-}" ]]; then
    echo "Già alla versione ${version#node-}."
    return
  fi
  local tmp; tmp=$(mktemp -d)
  curl -fsSL -o "$tmp/$file" "$base/$file"
  (cd "$tmp" && grep " $file\$" <<<"$sums" | sha256sum -c --quiet -)
  rm -rf "$NODE_HOME" && mkdir -p "$NODE_HOME"
  tar -xJf "$tmp/$file" -C "$NODE_HOME" --strip-components=1
  rm -rf "$tmp"
  echo "Installato ${version#node-}."
}

deps() {
  step "Dipendenze di brain (solo quelle: la PWA sta su Vercel)"
  (cd "$REPO" && PATH="$NODE_HOME/bin:$PATH" npm ci --omit=dev --no-audit --no-fund -w @homeboard/brain)

  step "voice: ambiente Python in $VENV e modelli (Vosk, Kokoro, openWakeWord: circa 500 MB la prima volta)"
  [[ -x "$VENV/bin/python" ]] || python3 -m venv "$VENV"
  "$VENV/bin/pip" install -q --upgrade pip
  "$VENV/bin/pip" install -q -e "$REPO/services/voice[audio,vosk]"
  set -a
  # shellcheck source=/dev/null
  source "$ENVFILE"
  set +a
  "$VENV/bin/python" -m roby_voice.fetch
}

units() {
  step "Servizi systemd (utente)"
  # shellcheck source=/dev/null
  source "$ENVFILE"
  mkdir -p "$UNITS"
  # Via le unità della vecchia TV a sei canali, se c'erano.
  for old in homeboard-piper.service homeboard-wake.service; do
    systemctl --user disable --now "$old" 2>/dev/null || true
    rm -f "$UNITS/$old"
  done
  for unit in "$HERE"/systemd/*; do
    sed "s/@NIGHT_START@/$NIGHT_START/; s/@NIGHT_END@/$NIGHT_END/" "$unit" >"$UNITS/$(basename "$unit")"
  done
  if ! systemctl --user daemon-reload 2>/dev/null; then
    echo "systemd dell'utente non raggiungibile (niente sessione?): unità copiate, attivale dopo il riavvio."
    return
  fi
  systemctl --user enable homeboard-brain.service homeboard-voice.service \
    homeboard-screen-off.timer homeboard-screen-on.timer homeboard-watchdog.timer \
    homeboard-refresh.timer homeboard-update.timer
}

if [[ "${1:-}" == "--solo" ]]; then
  shift
  for s in "$@"; do
    case "$s" in
      system | config | deps | units) "$s" ;;
      node) install_node ;;
      *) echo "Passo sconosciuto: $s (system, config, node, deps, units)" >&2; exit 2 ;;
    esac
  done
  exit 0
fi

if ! $UPDATE_ONLY; then system; fi
config
install_node
deps
units

if $UPDATE_ONLY; then
  echo "Aggiornamento installato."
  exit 0
fi
step "Fatto"
cat <<EOF
1. Controlla $ENVFILE (Supabase, TV_URL, orari della notte).
2. Riavvia con: sudo reboot
3. Sullo schermo compare un codice: abbina Roby dalla PWA (Impostazioni → Abbina una TV).
Log:    journalctl --user -u homeboard-brain -u homeboard-voice -u homeboard-kiosk -f
Audio:  speaker-test -c 2 -t wav   ·   $VENV/bin/python -m roby_voice.mics
EOF
