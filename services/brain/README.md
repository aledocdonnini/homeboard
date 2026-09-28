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
| `src/state.ts` | lo stato di `/casa`; i promemoria da annunciare |

Test: `npm test` dalla radice (copia locale ed esecutore, su SQLite in memoria).

## Simulatore

Per lavorare su `/casa` senza Supabase, `src/simulator.ts` fa le veci di `brain`. Usa lo stesso protocollo, tiene lo stato in memoria e passa dall'interprete vero le frasi scritte nel terminale:

```bash
npm run simulate -w @homeboard/brain   # ws://127.0.0.1:8765; /help per i comandi, --demo per il giro dei pannelli
```
