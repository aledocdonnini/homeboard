#!/usr/bin/env bash
# Aggiornamento del software: git pull del ramo scelto e, se è cambiato qualcosa, dipendenze, modelli e servizi.
# Lo lancia homeboard-update.timer ogni notte; a mano: ~/homeboard/device/bin/update.sh
# Non tocca niente se ci sono modifiche locali o se manca la rete: riprova la notte dopo.
# Tornare indietro: cd ~/homeboard && git checkout <commit> && device/install.sh --update
set -euo pipefail
# shellcheck source=/dev/null
source "$HOME/.config/homeboard/homeboard.env"
if [[ -z "${UPDATE_BRANCH:-}" ]]; then
  echo "Aggiornamenti automatici disattivati (UPDATE_BRANCH vuoto)."
  exit 0
fi
cd "$(dirname "$0")/../.."
before=$(git rev-parse HEAD)
if ! git fetch -q origin "$UPDATE_BRANCH" || ! git merge -q --ff-only "origin/$UPDATE_BRANCH"; then
  echo "Aggiornamento non possibile (rete assente o modifiche locali): riprovo la prossima volta."
  exit 0
fi
if [[ "$(git rev-parse HEAD)" == "$before" ]]; then
  echo "Già aggiornato."
  exit 0
fi
echo "Aggiornato: $(git log --oneline "$before..HEAD" | wc -l | tr -d ' ') commit, ora $(git rev-parse --short HEAD)."
./device/install.sh --update
systemctl --user restart homeboard-brain.service homeboard-voice.service
