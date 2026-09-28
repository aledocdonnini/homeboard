# brain

Servizio Node sul Raspberry. Fa da ponte fra la voce, i dati e lo schermo:

```
voice ──socket Unix /run/user/…/roby.sock (JSON a righe)──▶ brain ──ws://127.0.0.1:8765──▶ /casa
                                                            │
                                                  SQLite (copia locale + outbox) ⇄ Supabase
```

- Riceve da `voice` solo testo trascritto e lo passa a `@homeboard/intents`.
- Esegue le azioni sulla copia locale in SQLite e le mette in coda per Supabase, con le stesse regole di sincronizzazione della PWA (`@homeboard/core/sync`). Così senza internet funzionano lo stesso timer, spesa e liste.
- Tiene i timer: allarme, stop a voce, più timer con un nome. Quando c'è rete li pubblica nella tabella `timers`, che la PWA mostra.
- Chiede conferma per le azioni distruttive.
- Registra le frasi non capite (`unparsed_log`).
- Tiene la sessione del dispositivo (un utente anonimo di Supabase abbinato con un codice) e manda a `/casa` lo stato da mostrare. I messaggi sono in `packages/core/src/protocol.ts`.

## Avvio

```bash
cp services/brain/.env.example services/brain/.env   # URL e chiave pubblica di Supabase
npm start -w @homeboard/brain                          # poi apri /casa: compare il codice da abbinare
```

Al primo avvio `brain` entra come utente anonimo e mostra un codice. Lo abbini dalla PWA (*Impostazioni → Abbina una TV*); da lì la sessione resta nella copia locale.

Senza `voice` collegato, le frasi si scrivono nel terminale, una per riga. Ci sono anche due comandi: `/stato` stampa quello che vede `/casa`, `/coda` le modifiche che aspettano la rete.

| File | Cosa fa |
|---|---|
| `src/main.ts` | collega tutto: WebSocket per `/casa`, socket per `voice`, terminale, timer e promemoria da annunciare |
| `src/store.ts` | copia locale in SQLite (`node:sqlite`) con la coda delle modifiche |
| `src/cloud.ts` | Supabase: sessione, abbinamento, invio della coda, download, realtime, battito, copia dei timer |
| `src/executor.ts` | dall'intento all'azione, con la frase da dire e il pannello da mostrare |
| `src/timers.ts` | i timer, salvati in locale |
| `src/notes.ts` | il second brain: embedding delle note, ricerca per significato, risposta con data e origine |
| `src/state.ts` | lo stato di `/casa`; i promemoria da annunciare |

Test: `npm test` dalla radice (copia locale ed esecutore, su SQLite in memoria).

## Note: il second brain

"Ricorda che le batterie di ricambio sono nel cassetto" e poi "dove sono le pile?". `brain` ritrova le note per significato, anche senza internet.

- **Embedding.** Il modello è `paraphrase-multilingual-MiniLM-L12-v2`: 384 dimensioni, circa 120 MB quantizzato, circa 1 ms a frase sul Mac, con transformers.js. Ogni nota ha il suo embedding nella copia locale, e una copia va nella colonna pgvector `notes.embedding` in Supabase. Il modello lo scarica `device/install.sh`; sul Mac si scarica la prima volta.
- **Punteggio.** Somiglianza di significato, più 0,1 per ogni parola significativa in comune.
  - Sotto 0,45: "Non ho niente annotato su questo".
  - Fra 0,45 e 0,6: Roby risponde, ma con "Forse intendi questo".
  - Senza modello: si cerca solo per parole.
- **Risposta.** Di norma è la nota stessa, con data e origine: "Il 12 marzo mi hai detto: …", "Ieri hai scritto: …", "Oggi hai salvato: …" (dal telefono, con Condividi). Con un modello linguistico autorizzato per le note (`ROBY_LLM`, README principale) risponde lui con parole sue, usando solo le tre note più pertinenti, e Roby aggiunge da dove viene la risposta: "Me l'hai detto il 12 marzo.".
- **Domande libere.** Una frase che le regole non capiscono, per esempio "cosa mi serve per il tiramisù?", si cerca comunque fra le note prima di rispondere "non ho capito".
- **Valutazione.** `npm run eval:note -w @homeboard/brain` gira col modello vero su note e domande di casa: 14 risposte giuste su 16.
  - "Quando scade la patente?" trova la garanzia della lavatrice, ma la dice con "forse".
  - "Dove ho messo il caricabatterie?" trova le batterie con sicurezza. È un limite del modello piccolo; un modello linguistico, se c'è, risponde che nelle note non c'è.

La PWA non calcola embedding: servirebbero 120 MB sul telefono. Lì la ricerca resta per parole, sul server (full-text in italiano).

## Simulatore

Per lavorare su `/casa` senza Supabase, `src/simulator.ts` fa le veci di `brain`. Usa lo stesso protocollo, tiene lo stato in memoria e passa dall'interprete vero le frasi scritte nel terminale:

```bash
npm run simulate -w @homeboard/brain   # ws://127.0.0.1:8765; /help per i comandi, --demo per il giro dei pannelli
```
