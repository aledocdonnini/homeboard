# brain

Servizio Node sul Raspberry (fase 4). Fa da ponte fra la voce, i dati e lo schermo:

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

## Simulatore

Finché `brain` non c'è (fase 4), `src/simulator.ts` fa le sue veci per la vista `/casa`. Usa lo stesso protocollo, tiene lo stato in memoria e passa dall'interprete vero le frasi scritte nel terminale:

```bash
npm run simulate -w @homeboard/brain   # ws://127.0.0.1:8765; /help per i comandi, --demo per il giro dei pannelli
```
