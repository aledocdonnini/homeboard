# Input vocale: progetto (da non implementare ora)

Obiettivo: dire "aggiungi il pane", "ricordami domani alle 9 di chiamare l'idraulico" o "il bollo scade il 3 marzo" e ritrovarlo in lista, nei promemoria o nelle scadenze. Prima nella PWA; la TV si aggiunge in un secondo momento, se ci mettiamo un microfono.

## Principio: la voce diventa testo, il testo diventa un'azione proposta

```
voce ──▶ testo ──▶ interpretazione ──▶ conferma ──▶ scrittura
        (STT)      parseCommand()      (Roby in     (stesse funzioni
                   pura, testata       ascolto)      della PWA)
```

- **Testo prima di tutto.** L'interprete lavora su testo, quindi serve anche all'aggiunta rapida in linguaggio naturale ("latte e uova domani") senza microfono. È il primo pezzo da fare, ed è utile anche da solo.
- **Nessuna scrittura senza conferma.** Un riconoscimento sbagliato non deve mettere in lista "pane" al posto di "panna". La PWA mostra cosa ha capito ("Aggiungo alla spesa: pane") con due pulsanti, *Aggiungi* e *Correggi*. Una sola eccezione, eventuale: le frasi della spesa con più cose riconosciute in modo netto.
- **Stesse strade delle modifiche a mano.** La spesa passa dalla coda offline (`engine.ts`, `change()`), promemoria e scadenze dalle stesse insert. Nessuna API nuova.

## 1. Riconoscimento (voce → testo)

| Opzione | Pro | Contro | Uso |
|---|---|---|---|
| Web Speech API (`SpeechRecognition`, `lang: "it-IT"`) | gratis, zero server, già nei browser | su Chrome l'audio va ai server di Google; su iOS funziona solo in Safari/PWA recenti, con qualità variabile | **primo passo**, dietro una verifica di supporto |
| Whisper via Groq (come `roby/server/stt.ts`) | ottimo in italiano, uguale su tutti i browser | serve una chiave e un endpoint server (Edge Function), piccoli costi oltre la quota gratuita | se la Web Speech API delude |
| Vosk nel browser (come `roby/lib/wake.ts`) | tutto sul dispositivo, privato | modello pesante (~50 MB), meno preciso sulle frasi libere | solo per la parola di attivazione |

Scelta: Web Speech API dove c'è, Whisper come alternativa. Il codice di Roby per Whisper, compreso il filtro delle "frasi fantasma" nel silenzio, si riusa quasi com'è in una Edge Function `transcribe`, protetta dal JWT del membro.

## 2. Interpretazione (testo → azione)

Una funzione pura, `parseCommand(text, now, tz)`, in `supabase/functions/_shared/`, così la può usare anche una futura Edge Function. Restituisce una o più proposte:

```ts
type Proposal =
  | { kind: "shopping"; names: string[] }
  | { kind: "reminder"; title: string; date: PlainDate; time: string; recurrence: Recurrence | null }
  | { kind: "deadline"; title: string; due: PlainDate; recurrence: Recurrence | null }
  | { kind: "unknown"; text: string };
```

Regole semplici, in italiano, prima di qualsiasi modello:

- **Spesa:** "aggiungi / metti / compra / prendi …", oppure una frase senza verbo ("latte e uova"). Si divide su virgole e sulla "e" finale ("latte, uova e pane"), ma non dentro i nomi composti noti ("sale e pepe", "olio e aceto"), grazie a un piccolo elenco.
- **Promemoria:** "ricordami / promemoria …" più una data e un'ora.
- **Scadenze:** "scade / scadenza / da pagare / entro …" più una data.
- **Date relative:** oggi, domani, dopodomani, lunedì…domenica (il prossimo), "tra 3 giorni", "il 3 marzo", "a fine mese".
- **Ore:** "alle 9", "alle 18 e 30", "alle nove e mezza", "stasera" (20:00), "stamattina" (09:00).
- **Ricorrenze:** "ogni giorno / settimana / lunedì / mese / anno", "ogni 2 anni". Producono le stesse `Recurrence` di `recurrence.ts`.

Test: una tabella di frasi reali (quelle che diciamo davvero in casa) con il risultato atteso, come per le ricorrenze. Quando le regole non bastano, un **modello gratuito** può proporre la stessa struttura: per esempio Workers AI, oppure Groq come in Roby, con output JSON validato. Resta però dietro la stessa conferma. Tempo di risposta e privacy vanno valutati prima.

## 3. Interfaccia (PWA)

- **Pulsante microfono** accanto al campo di aggiunta rapida e nella barra di "Oggi". Si tiene premuto per parlare, si rilascia per inviare: meno falsi avvii, e il permesso del microfono si chiede al primo uso.
- **Roby in modalità `listening`** mentre ascolta (la testa si inclina, i bagliori ai lati: c'è già nel motore). Se c'è l'audio vero, il livello del microfono muove i bagliori (`meter()` di Roby).
- **La proposta compare sotto:** "Aggiungo alla spesa: pane, latte". *Aggiungi* conferma; *Correggi* apre il testo per modificarlo.
- **Accessibilità:** il pulsante ha un nome ("Parla"), lo stato è annunciato (`role="status"`), e tutto resta possibile a tastiera, perché il microfono è solo una scorciatoia.

## 4. La TV (dopo)

La TV oggi non ha microfono. Con uno USB sul Raspberry:

- **Parola di attivazione "Ehi Roby"** sul dispositivo, con Vosk come in Roby: nessun audio esce di casa prima della parola.
- **Il resto come nella PWA,** con la conferma a voce ("Aggiungo pane alla spesa. Va bene?") e un tasto di preselezione come "sì".
- **Permessi:** la TV oggi è in sola lettura. Serve un permesso in più e limitato, per esempio una RPC `add_from_tv(names)` che accetta solo aggiunte alla spesa, con un limite di frequenza. Resta un'aggiunta esplicita alle policy, non un allargamento generale.

## Fasi e stime

| Passo | Impegno | Valore |
|---|---|---|
| `parseCommand` con regole e test | 2-3 giorni | alto: serve anche senza voce (aggiunta in linguaggio naturale) |
| Aggiunta in linguaggio naturale nel campo di testo, con proposta e conferma | 1 giorno | alto |
| Microfono nella PWA con la Web Speech API | 1 giorno | medio (dipende dal browser) |
| Edge Function `transcribe` con Whisper (da Roby) | mezza giornata | medio: qualità uniforme |
| TV con microfono e "Ehi Roby" | 3-4 giorni con l'hardware | alto come effetto, basso nell'uso quotidiano |

Rischi: la qualità variabile della Web Speech API su iOS; le frasi ambigue ("prendi il latte domani" è spesa o promemoria?), che si risolvono chiedendo nella conferma; la privacy con Chrome e Whisper, da spiegare in una riga accanto al microfono.
