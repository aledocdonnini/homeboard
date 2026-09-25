# Homeboard sul Raspberry Pi

La TV Crezar: un Raspberry Pi 4 dentro la scocca, un monitor 10,5" 3:2 (1920×1280) al posto del tubo, e i sei tasti di preselezione originali collegati ai GPIO. All'accensione parte Chromium a tutto schermo su `/tv`, senza tastiera né mouse.

## Cosa serve

- Raspberry Pi 4 con alimentatore ufficiale e una microSD da almeno 16 GB.
- Monitor HDMI (o DSI); altoparlanti o una piccola cassa sull'uscita audio o sull'HDMI, per la voce di Roby.
- I sei tasti della Crezar: ognuno va fra un GPIO e GND. La resistenza di pull-up è quella interna, niente componenti in più.

| Tasto | Canale | GPIO (BCM) | Pin fisico |
|---|---|---|---|
| 1 | In onda ora | 5 | 29 |
| 2 | Spesa | 6 | 31 |
| 3 | Promemoria | 13 | 33 |
| 4 | Scadenze | 19 | 35 |
| 5 | Monoscopio | 26 | 37 |
| 6 | Roby | 16 | 36 |

Per GND vanno bene i pin 30, 34 o 39. Sono tasti meccanici: se un tasto "rimbalza" (un clic, due cambi canale), si aggiunge `debounce=50` alla sua riga in `config/config.txt`.

## Installazione

1. **Sistema.** Con Raspberry Pi Imager scrivi *Raspberry Pi OS Lite (64-bit)* sulla microSD. Nelle impostazioni dell'Imager scegli utente e password, attiva SSH e inserisci il Wi-Fi.
2. **Copia questa cartella sul Pi**, dal Mac:
   ```sh
   scp -r device/ <utente>@<nome-del-pi>.local:~/homeboard-device
   ```
3. **Installa**, sul Pi:
   ```sh
   cd ~/homeboard-device && ./install.sh
   ```
   Lo script:
   - installa labwc, Chromium e wlr-randr;
   - crea l'ambiente Python di Piper e scarica la voce italiana (circa 60 MB);
   - aggiunge a `/boot/firmware/config.txt` i tasti e il watchdog;
   - imposta il login automatico e i servizi systemd.

   Si può rilanciare senza danni.
4. **Configura** `~/.config/homeboard/homeboard.env`:
   - `TV_URL`: l'indirizzo dell'app su Vercel, con `/tv` in fondo;
   - `NIGHT_START` e `NIGHT_END`: allineali agli orari notturni della casa.

   Se cambi gli orari, rilancia `./install.sh` per aggiornare i timer.
5. **Riavvia** con `sudo reboot`. La TV mostra un codice e un QR: dalla PWA, *Casa → Abbina una TV*, oppure inquadra il QR. La sessione della TV resta nel profilo di Chromium, quindi l'abbinamento si fa una volta sola.

## Tarature (a TV montata)

- **Cornice.** Se la scocca copre i bordi del pannello, aumenta `overscan` in `TV_URL`. Il valore è in percentuale del lato corto, da 0 a 20; il predefinito è 4. Poi `systemctl --user restart homeboard-kiosk`.
- **Uscita video.** `wlr-randr` elenca le uscite. Se il pannello non si spegne di notte, imposta `OUTPUT` (per esempio `HDMI-A-1` o `DSI-1`).
- **Volume.** Si regola con `alsamixer`. Il fruscio del cambio canale è volutamente basso.

## Come sta in piedi da sola

| Cosa succede | Chi rimedia |
|---|---|
| Chromium va in crash o si chiude | `homeboard-kiosk.service` lo rilancia dopo 3 secondi, sempre |
| Chromium si pianta o la pagina non è più `/tv` | `watchdog.sh` ogni 2 minuti interroga la porta di debug locale e, se serve, riavvia il kiosk |
| Memoria che cresce nei giorni | il kiosk si riavvia ogni notte alle 4 (`homeboard-refresh.timer`) |
| Il sistema si blocca | il watchdog hardware riavvia il Pi dopo 15 secondi (`RuntimeWatchdogSec`) |
| Cade la rete | la pagina è in cache nel service worker e mostra l'ultima copia dei dati; al ritorno della rete si riallinea |
| Corrente che va e viene | al riavvio tutto riparte da solo, con il pannello acceso o spento secondo l'ora |

Di notte il pannello si spegne (`homeboard-screen-off.timer`) e si riaccende al mattino. Un tasto di preselezione lo riaccende per 2 minuti (`wake-on-key.py`): la pagina fa lo stesso, e mostra i contenuti invece di "Fine delle trasmissioni".

## La voce di Roby

`bin/piper-server.py` ascolta solo su `127.0.0.1:5002` e trasforma un testo in un WAV con Piper. La pagina lo usa con `?voce=http://127.0.0.1:5002/?text=`: Roby muove gli occhi seguendo l'audio vero. Senza il parametro usa la voce del browser, che su Linux è di bassa qualità.

La pagina arriva da internet (https) e chiama un indirizzo locale. Chromium lo permette grazie a tre accorgimenti:
- `127.0.0.1` conta come contesto sicuro, quindi non c'è blocco per contenuto misto;
- il server risponde con le intestazioni di accesso alla rete locale;
- la policy `/etc/chromium/policies/managed/homeboard.json` autorizza l'origine dell'app, senza richieste di permesso che nessuno potrebbe accettare.

Prova: `curl -o /tmp/prova.wav 'http://127.0.0.1:5002/?text=Ciao'`, poi `aplay /tmp/prova.wav`.

## Cosa è verificato e cosa no

- **Verificato:** il server Piper, in un container Linux arm64 (la stessa architettura del Pi 4), con la voce `it_IT-paola-medium`: WAV da 22 kHz, intestazioni CORS e di rete locale, e Roby che parla dalla pagina con l'audio di Piper. Anche la logica notte/giorno degli script, con gli stessi casi dei test dell'app. Sintassi di tutti gli script (bash, Python) e shellcheck.
- **Da verificare sul Pi**, prima volta:
  - i nomi dei pacchetti della versione di Raspberry Pi OS (`chromium` o `chromium-browser`);
  - che la policy sull'accesso alla rete locale sia quella della versione di Chromium installata (`chrome://policy`);
  - il nome del dispositivo dei tasti (`/dev/input/by-path/*gpio-keys*`);
  - la fluidità di CRT e neve a 1920×1280. Se scatta, il primo da togliere è il tremolio (`crt-flicker` in `globals.css`), poi la banda di scansione.

## Comandi utili

```sh
journalctl --user -u homeboard-kiosk -u homeboard-piper -u homeboard-wake -f   # log
systemctl --user restart homeboard-kiosk                                        # ricarica la TV
systemctl --user list-timers 'homeboard-*'                                      # prossimi eventi
~/homeboard/bin/screen.sh on                                                    # pannello acceso adesso
evtest                                                                          # prova dei tasti (sudo apt install evtest)
```
