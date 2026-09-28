# voice

La parte audio della postazione, in Python (3.11, come Raspberry Pi OS Bookworm). Tutto gira in locale e l'audio non lascia mai il Pi: a `brain` arriva solo il testo trascritto.

```
riposo ──"Ehi Roby" o tasto──▶ ascolto ──fine frase (VAD)──▶ trascrizione ──testo──▶ brain
   ▲                                                                                  │
   └──────────── fine del parlato ◀── Piper parla (volume → bocca di Roby) ◀── "say" ─┘
```

| File | Cosa fa |
|---|---|
| `roby_voice/main.py` | la macchina a stati: riposo, ascolto, attesa, parla; barge-in, allarme, tasti |
| `roby_voice/ears.py` | parola di attivazione (openWakeWord) e voce sì/no (Silero VAD) |
| `roby_voice/endpoint.py` | quando hai finito di parlare (logica pura, testata) |
| `roby_voice/stt.py` | trascrizione: `SttEngine` con Vosk e faster-whisper |
| `roby_voice/tts.py` | sintesi, una frase alla volta: Kokoro (predefinito) o Piper |
| `roby_voice/audio.py` | microfono, altoparlante interrompibile con il volume per la bocca, bip e allarme |
| `roby_voice/link.py` | il filo con `brain` (socket Unix, JSON a righe; messaggi in `protocol.py`) |
| `roby_voice/keys.py` | i tasti del televisore via gpio-key (`/dev/input`, libreria standard) |
| `roby_voice/fetch.py` | scarica i modelli, una volta sola |
| `roby_voice/bench.py` | misura latenza e precisione della trascrizione, e velocità della sintesi |
| `roby_voice/mics.py` | quale microfono sente davvero (picco per ogni ingresso) |

## Avvio

Sul Pi lo installa `device/install.sh`. A mano:

```bash
python3 -m venv .venv && . .venv/bin/activate
pip install -e ".[audio,vosk]"          # più ",whisper" per faster-whisper
python -m roby_voice.fetch              # modelli in ~/.local/share/roby/models (ROBY_MODELS)
roby-voice                              # microfono e altoparlante veri; brain deve essere acceso
```

Configurazione con variabili d'ambiente (`roby_voice/config.py`):
- `ROBY_STT=vosk|whisper`;
- `ROBY_TTS=kokoro|piper`, con `ROBY_KOKORO_VOICE=if_sara|im_nicola` e `ROBY_KOKORO_SPEED`;
- `ROBY_WAKE_MODEL`, `ROBY_WAKE_THRESHOLD`;
- `ROBY_BARGE_IN=wake|vad`;
- `ROBY_INPUT_DEVICE` e `ROBY_OUTPUT_DEVICE`;
- `ROBY_KEYS_DEVICE` con `ROBY_KEY_MUTE` e `ROBY_KEY_TALK`;
- `VOICE_SOCKET`.

**Senza microfono** (sul Mac, in Docker arm64 come il Pi):

```bash
docker build -f Dockerfile.dev -t roby-voice-dev .
docker run --rm -v "$PWD":/src -v roby-models:/models roby-voice-dev python -m roby_voice.fetch
docker run --rm -v "$PWD":/src roby-voice-dev sh -c "pytest -q tests && mypy roby_voice tests"
# Una frase da file, collegata a brain sul Mac (brain con VOICE_SOCKET=tcp://127.0.0.1:8766):
docker run --rm -v "$PWD":/src -v roby-models:/models -e VOICE_SOCKET=tcp://host.docker.internal:8766 \
  roby-voice-dev roby-voice --wav /models/bench-sintetiche/05.wav --subito --out /tmp/out
```

## Comportamento

- **Parola di attivazione.** Dopo "Ehi Roby" suona un bip e Roby ascolta. La frase finisce dopo 0,7 s di silenzio; se nessuno parla entro 5 s si torna a riposo. Una frase dura al massimo 10 s.
- **Tasto "premi e parla".** Come la parola di attivazione.
- **Tasto microfono.** Spegne l'ascolto (due note scendenti) e lo riaccende (due note salenti). Lo stato va a `brain` e si vede sempre su `/casa`.
- **Barge-in.** Mentre Roby parla, "Ehi Roby" o il tasto lo interrompono e si ascolta subito. Questo è il comportamento predefinito (`ROBY_BARGE_IN=wake`). Il barge-in "basta parlare" (`vad`) va attivato solo con un microfono che cancella l'eco, come il ReSpeaker: senza, Roby sente la propria voce dall'altoparlante e si interrompe da solo.
- **"Confermi?"** Dopo una domanda di `brain` (per esempio "Tolgo tutto?") si ascolta la risposta senza parola di attivazione.
- **Allarme dei timer.** Suona finché `brain` non lo spegne. Intanto basta parlare ("basta!"), senza "Ehi Roby".

## Microfono

`python -m roby_voice.mics` registra un secondo e mezzo da ogni ingresso e stampa il picco. Il nome di quello che sente va in `ROBY_INPUT_DEVICE`. Picco 0 vuol dire silenzio "finto": su macOS manca il permesso del microfono per il Terminale, oppure il MacBook è chiuso e il microfono interno è spento.

Con `ROBY_DEBUG=1`, `voice` stampa ogni secondo il picco del microfono e il punteggio della parola di attivazione: serve a tarare `ROBY_WAKE_THRESHOLD`.

## Voce di Roby

Kokoro (82M parametri, licenza Apache 2.0) ha voci italiane molto più naturali di Piper; Piper però è molto più veloce. Il confronto l'abbiamo fatto a orecchio sulle stesse frasi, e ha vinto Kokoro `if_sara`. Misure con `python -m roby_voice.bench --voci`, su 6 risposte tipiche:

| voce | carica | prima frase | RTF |
|---|---|---|---|
| Piper `it_IT-paola-medium` | 0,5 s | 46–66 ms | 0,02 |
| Kokoro `if_sara`, fp32 | 0,4–0,6 s | 226–255 ms | 0,13 |

I numeri sono misurati sul Mac M-series, in nativo e in Docker Linux arm64. Sul Pi 5 ci si aspetta 4–6 volte più lento: Kokoro dovrebbe restare sotto RTF 1 (la voce è pronta prima di finire di parlare), con una prima frase entro circa un secondo. Si verifica sul Pi con lo stesso comando. Se è troppo lento, `ROBY_TTS=piper`. Il modello int8 di Kokoro sul Mac è risultato più lento del fp32: sul Pi va misurato.

## Misure della trascrizione

`python -m roby_voice.bench` sintetizza con Piper le 30 frasi di `bench/frasi.txt` e le trascrive con ogni motore. Colonne della tabella:
- **carica:** tempo di caricamento del modello;
- **media** e **p90:** latenza di una frase;
- **RTF:** tempo di calcolo diviso la durata dell'audio (sotto 1 è più veloce del parlato);
- **WER:** percentuale di parole sbagliate, con numeri e accenti normalizzati;
- **esatte:** frasi trascritte senza errori.

**Mac M-series, Docker arm64, voce sintetica** (28 settembre 2026):

| motore | carica | media | p90 | RTF | WER | esatte |
|---|---|---|---|---|---|---|
| Vosk `small-it-0.22` | 0,3 s | 152 ms | 208 ms | 0,10 | 17% | 14/30 |
| faster-whisper `base` int8 | 0,3 s | 254 ms | 291 ms | 0,18 | 34% | 5/30 |
| faster-whisper `small` int8 | 1,0 s | 963 ms | 882 ms | 0,69 | 27% | 11/30 |

Come leggerle:
- **Non sono le misure del Pi.** Il Pi 5 è diverse volte più lento di un M-series. Per Whisper `small` vuol dire probabilmente più di 2 s a frase: troppo per una risposta "istantanea".
- **La voce sintetica pesa sugli errori.** Piper "paola" pronuncia male alcune "r" (Whisper sente "filto", "scotta"), e non ha rumore né eco di stanza.
- **Per ora il predefinito è Vosk.** "Timer", che è una parola inglese, Vosk lo sente spesso come "time" o "team": l'interprete accetta anche queste forme (`packages/intents`, con i casi nel corpus).

**Sul Pi, con voci vere:**

```bash
python -m roby_voice.bench --registra                   # legge a voce le 30 frasi (Invio, poi parla)
python -m roby_voice.bench --dir bench/registrate --motori vosk,whisper-base,whisper-small
```

Le registrazioni restano sul Pi: `bench/registrate/` non va in git.

## "Ehi Roby": addestrare la parola di attivazione

Finché non c'è il modello addestrato, la parola è **"hey jarvis"**, un modello già pronto di openWakeWord. Per addestrare "Ehi Roby" bastano una sessione gratuita su Google Colab e circa un'ora.

1. Apri il notebook `notebooks/automatic_model_training.ipynb` del repository di openWakeWord su Colab, con la GPU gratuita.
2. Come frase imposta `ehi roby` e aggiungi le varianti che la gente dice davvero: `hey roby`, `ei roby`. Il notebook genera migliaia di esempi sintetici con Piper (voci e velocità diverse), mescolati a rumore e riverbero, più gli esempi negativi dai dataset che scarica.
3. Addestra con i valori predefiniti (circa 50.000 esempi, qualche decina di minuti) ed esporta `ehi_roby.onnx`.
4. Copialo in `~/.local/share/roby/models/openwakeword/ehi_roby.onnx` e imposta `ROBY_WAKE_MODEL=ehi_roby`.
5. **Taratura:** lascialo acceso un giorno con la TV e le chiacchiere di casa. Se si attiva da solo, alza `ROBY_WAKE_THRESHOLD` (0,5 → 0,6/0,7); se non ti sente, abbassala.
