# Roby sul Raspberry Pi

La postazione di casa è un Raspberry Pi 5 dentro la scocca della Crezar, con un monitor da 10,5" al posto del tubo. Si usa solo a voce: "Ehi Roby", e lo schermo mostra le risposte. All'accensione partono tre cose da sole:

| Servizio | Cosa fa |
|---|---|
| `homeboard-brain` | `services/brain`: interpreta, esegue, tiene timer e copia locale, parla con Supabase e con lo schermo |
| `homeboard-voice` | `services/voice`: parola di attivazione, trascrizione, voce di Roby; l'audio non esce dal Pi |
| `homeboard-kiosk` | Chromium a tutto schermo su `/casa`, che legge tutto da `brain` su `ws://127.0.0.1:8765` |
| `homeboard-music` | go-librespot: il Pi come altoparlante Spotify Connect "Roby", comandato a voce da `brain` |

## Cosa serve

- **Raspberry Pi 5 (8 GB)**, con alimentatore ufficiale da 27 W e una microSD da almeno 32 GB (i modelli occupano circa 1 GB).
- **Monitor portatile 10,5" 1920×1280** con altoparlanti. Il Pi 5 ha porte micro-HDMI, il monitor mini-HDMI: serve un cavo **micro-HDMI → mini-HDMI**, sulla porta **HDMI 0**, quella accanto all'alimentazione. L'audio va sugli altoparlanti del monitor, attraverso l'HDMI.
- **Un microfono USB.** Meglio un array come il ReSpeaker USB, che cancella l'eco e permette il barge-in "basta parlare"; va bene anche un buon microfono USB da conferenza.
- **Due tasti del televisore**, ognuno fra un GPIO e GND. La resistenza di pull-up è quella interna, niente componenti in più.

| Tasto | Cosa fa | GPIO (BCM) | Pin fisico |
|---|---|---|---|
| Microfono | spegne e riaccende l'ascolto (lo stato si vede sempre sullo schermo) | 5 | 29 |
| Parla | come dire "Ehi Roby"; interrompe Roby mentre parla | 6 | 31 |

Per GND vanno bene i pin 30, 34 o 39. Se un tasto "rimbalza" (un clic, due azioni), si aggiunge `debounce=50` alla sua riga in `config/config.txt`.

## Installazione

1. **Sistema.** Con Raspberry Pi Imager scrivi *Raspberry Pi OS Lite (64-bit)* sulla microSD. Nelle impostazioni dell'Imager scegli utente e password, attiva SSH e inserisci il Wi-Fi.
2. **Il codice**, sul Pi (via SSH):
   ```sh
   sudo apt-get install -y git
   git clone https://github.com/aledocdonnini/homeboard ~/homeboard
   ~/homeboard/device/install.sh
   ```
   Lo script:
   - installa labwc, Chromium, wlr-randr e i pacchetti audio;
   - installa Node 22 (dal sito ufficiale, con controllo del checksum) e le sole dipendenze di `brain`;
   - crea l'ambiente Python di `voice` e scarica i modelli (Vosk, Kokoro, openWakeWord: circa 500 MB);
   - aggiunge a `/boot/firmware/config.txt` i tasti e il watchdog;
   - attiva PipeWire, che mescola la voce di Roby e la musica e le manda all'HDMI;
   - installa go-librespot (Spotify Connect), versione e checksum bloccati;
   - imposta login automatico, policy di Chromium e servizi systemd.

   Si può rilanciare senza danni. Con `--solo <passo>` rifà un passo solo: `system`, `config`, `node`, `deps`, `units`.
3. **Configura** `~/.config/homeboard/homeboard.env`:
   - `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY`: le chiavi **pubbliche** del progetto, le stesse della PWA. Niente chiavi segrete: il Pi è un utente anonimo abbinato alla casa, i permessi li decidono le policy.
   - `TV_URL`: l'indirizzo dell'app, con `/casa` in fondo.
   - `NIGHT_START` e `NIGHT_END`, allineati agli orari notturni della casa.

   Se cambi gli orari, rilancia `~/homeboard/device/install.sh --solo units`.
4. **Riavvia** con `sudo reboot`. Sullo schermo compaiono un codice e un QR: dalla PWA, *Impostazioni → Abbina una TV*, oppure inquadra il QR. La sessione la tiene `brain` nella sua copia locale, quindi l'abbinamento si fa una volta sola.

## Tarature (a TV montata)

- **Audio.** `wpctl status` elenca uscite e microfoni di PipeWire; quelli predefiniti hanno un asterisco. Se non sono l'HDMI del monitor e il microfono USB, usa `wpctl set-default <numero>`. `~/homeboard/.venv-voice/bin/python -m roby_voice.mics` mostra quale microfono sente davvero. Il volume generale si regola con `wpctl set-volume @DEFAULT_AUDIO_SINK@ 80%`.
- **Spotify** (serve Premium). La prima volta che chiedi musica ("Ehi Roby, metti De André"), Roby mostra un codice: dal telefono vai su spotify.com/pair e inseriscilo. Da lì il Pi resta collegato al tuo account e compare come "Roby" fra i dispositivi Spotify Connect.
- **Parola di attivazione.** Con `ROBY_DEBUG=1` nel file di configurazione, `journalctl --user -u homeboard-voice -f` mostra ogni secondo il volume del microfono e il punteggio della parola. Se Roby si attiva da solo, alza `ROBY_WAKE_THRESHOLD`; se non ti sente, abbassala. Per "Ehi Roby" invece di "Hey Jarvis" c'è la guida in `services/voice/README.md`.
- **Velocità.** `python -m roby_voice.bench --voci` e `--registra`/`--dir` (vedi il README di `voice`) misurano sintesi e trascrizione sul Pi. Se Kokoro è lento, `ROBY_TTS=piper`.
- **Cornice.** Se la scocca copre i bordi del pannello, aumenta `overscan` in `TV_URL`. Il valore è in percentuale del lato corto, da 0 a 20. Poi `systemctl --user restart homeboard-kiosk`.
- **Uscita video.** `wlr-randr` elenca le uscite. Se il pannello non si spegne di notte, imposta `OUTPUT` (sul Pi 5 di solito `HDMI-A-1`).

## Come sta in piedi da sola

| Cosa succede | Chi rimedia |
|---|---|
| `brain`, `voice` o Chromium vanno in crash | systemd li rilancia dopo 3 secondi, sempre |
| Chromium si pianta o la pagina non è più `/casa` | `watchdog.sh` ogni 2 minuti interroga la porta di debug locale e, se serve, riavvia il kiosk |
| Memoria che cresce nei giorni | il kiosk si riavvia ogni notte alle 4 (`homeboard-refresh.timer`) |
| Il sistema si blocca | il watchdog hardware riavvia il Pi dopo 15 secondi (`RuntimeWatchdogSec`) |
| Cade la rete | `brain` lavora sulla copia locale (timer, spesa, liste) e al ritorno sincronizza; la pagina è in cache nel service worker |
| Corrente che va e viene | al riavvio tutto riparte da solo, con il pannello acceso o spento secondo l'ora |
| Una nuova versione del codice | ogni notte alle 4:30 `update.sh` fa `git pull` e, se è cambiato qualcosa, aggiorna dipendenze e servizi |

**Di notte** il pannello si spegne (`homeboard-screen-off.timer`) e si riaccende al mattino. Con il pannello spento tace anche l'audio HDMI. Per questo `brain`, prima di parlare, riaccende lo schermo per due minuti (`screen.sh wake`). Succede in tre casi: dopo "Ehi Roby" o il tasto, quando suona un timer e quando scatta un promemoria. La parola sentita col pannello spento fa partire il bip quando l'audio non c'è ancora, quindi il bip si perde; la risposta invece si sente. Gli arrivi dal telefono ("In lista: caffè") di notte non si annunciano.

**Aggiornamenti.**
- Segue il ramo `UPDATE_BRANCH`; vuoto vuol dire aggiornamenti spenti.
- Se sul Pi ci sono modifiche locali, l'aggiornamento non tocca niente.
- A mano: `~/homeboard/device/bin/update.sh`.
- Per tornare indietro: `cd ~/homeboard && git checkout <commit> && device/install.sh --update`.

La PWA si aggiorna da sola su Vercel; il kiosk la ricarica ogni notte.

## Cosa è verificato e cosa no

- **Verificato in un container Debian Bookworm arm64**, la base di Raspberry Pi OS:
  - i passi `node` e `deps` di `install.sh`, eseguiti da un utente normale: Node 22 con checksum, solo le dipendenze di `brain`, l'ambiente di `voice`;
  - `brain` che parte dal codice installato e mostra il codice di abbinamento;
  - Kokoro che parla.

  Inoltre: la sintassi e shellcheck di tutti gli script, e `brain` con `voice` e un microfono vero sul Mac.
- **Da verificare sul Pi**, prima volta:
  - il nome del pacchetto di Chromium (`chromium` o `chromium-browser`);
  - l'audio con PipeWire: uscita HDMI e microfono USB come predefiniti, voce e musica insieme;
  - go-librespot: collegamento dell'account col codice, musica dall'HDMI, e la musica che si abbassa quando Roby ascolta;
  - la policy di accesso alla rete locale della versione di Chromium installata (`chrome://policy`), perché la pagina deve poter aprire `ws://127.0.0.1:8765`;
  - i dispositivi dei tasti (`ls /dev/input/by-path/`: ogni riga `gpio-key` ne crea uno);
  - la velocità di Kokoro e Vosk (`bench`) e la fluidità di CRT e neve a 1920×1280. Se scatta, il primo da togliere è il tremolio (`crt-flicker` in `globals.css`), poi la banda di scansione.

## Comandi utili

```sh
journalctl --user -u homeboard-brain -u homeboard-voice -u homeboard-music -u homeboard-kiosk -f   # log
systemctl --user restart homeboard-brain homeboard-voice                         # riavvia Roby
systemctl --user list-timers 'homeboard-*'                                       # prossimi eventi
~/homeboard/device/bin/screen.sh wake                                            # pannello acceso per 2 minuti
evtest                                                                           # prova dei tasti (sudo apt install evtest)
```
