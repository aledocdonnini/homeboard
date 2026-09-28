# Progetto: assistente domestico vocale "Roby" — TV Crezar + PWA

## Contesto
Sono Alessandro, sviluppatore web (Next.js, Astro, Nuxt, Supabase, Vercel,
Netlify, Stripe). È un progetto personale e da portfolio. Vincolo forte:
**nessun costo ricorrente obbligatorio**. Tutto deve funzionare con
componenti locali e piani gratuiti; i servizi cloud a pagamento devono
essere opzionali e sostituibili tramite configurazione.

L'obiettivo è un assistente domestico in stile Alexa, a cui parlare per
gestire lista della spesa, timer, promemoria e scadenze, con due punti
di accesso:
1. **Postazione di casa**: Raspberry Pi dentro la scocca di un televisore
   portatile Crezar anni '70 (tubo catodico sostituito da un monitor
   moderno). Interazione **solo vocale**, lo schermo mostra e basta.
2. **PWA sul telefono**: per vedere e gestire tutto anche fuori casa, con
   notifiche push, input testuale e vocale.

Il volto dell'assistente è **Roby**, un mio progetto esistente con un
sistema di espressioni animate. Codice attuale: [percorso o repo di Roby].
Demo: roby-bot.vercel.app.

## Come procedere
Prima di scrivere codice: leggi il codice di Roby, proponimi
l'architettura dettagliata (struttura del monorepo, servizi, flussi dati)
e il piano a fasi, e fammi le domande che ti servono. Poi procedi una
fase alla volta, aspettando la mia conferma prima della successiva.
Imposta fin da subito l'architettura completa descritta qui, anche per
le parti che implementeremo più avanti, così non dovremo rifattorizzare.

## Architettura

### Principi
- **Il browser serve solo per l'interfaccia**, non per l'audio sul Pi
  (il riconoscimento vocale di Chromium su Linux dipende dai server Google
  e sul Raspberry non funziona).
- **Una sola logica di interpretazione dei comandi**, condivisa tra Pi e
  telefono: la stessa frase deve produrre la stessa azione ovunque.
- **L'audio non lascia mai il Pi.** Si trasmette solo il testo trascritto.
- **Il Pi deve funzionare anche senza internet** per le funzioni di base
  (timer, lettura e modifica delle liste), sincronizzando al ritorno
  della rete.

### Monorepo (proposta, valutala)
- `apps/web` — Next.js (App Router) + TypeScript: PWA mobile e vista casa
  (`/casa`), deploy su Vercel
- `packages/intents` — interprete dei comandi in TypeScript, puro e
  testabile, usato sia dalla PWA sia dal servizio sul Pi
- `packages/roby-face` — il volto di Roby come web component indipendente
- `services/brain` — servizio Node sul Pi: riceve il testo trascritto,
  usa `packages/intents`, esegue le azioni, gestisce i timer, mantiene una
  cache locale (SQLite) sincronizzata con Supabase, comunica con
  l'interfaccia tramite WebSocket locale
- `services/voice` — servizio Python sul Pi, solo audio: parola di
  attivazione, trascrizione, sintesi vocale. Parla con `brain` via
  WebSocket o socket locale
- `device/` — script e documentazione di installazione del Raspberry
- `supabase/` — migrazioni, policy RLS, Edge Functions

### Catena vocale sul Pi (tutta locale e gratuita)
- **Parola di attivazione**: openWakeWord, con un modello personalizzato
  "Ehi Roby" (documenta come addestrarlo)
- **Trascrizione**: interfaccia astratta con due implementazioni
  selezionabili da configurazione: Vosk (modello italiano, leggero) e
  faster-whisper (più preciso, più lento). Misura latenza e precisione
  di entrambe sul Pi e riportami i risultati
- **Sintesi vocale**: Piper con una voce italiana
- **Rilevamento fine frase** (VAD) e gestione del "barge-in" (se parlo
  mentre Roby risponde, Roby si interrompe)
- **Tasto fisico di silenziamento del microfono** per la privacy, con
  indicatore sempre visibile sullo schermo quando il microfono ascolta
  o è disattivato

### Interpretazione dei comandi
- Primo livello: **regole e modelli di frase** in italiano, con entità
  (quantità, date e orari relativi come "domani alle otto", "tra venti
  minuti", "ogni primo del mese"). Deve coprire la grande maggioranza
  dei comandi con risposta istantanea
- Secondo livello, **opzionale**: un modello linguistico come ripiego per
  le frasi che le regole non capiscono, dietro un'interfaccia astratta
  con queste implementazioni configurabili: nessuno (default), Ollama
  locale, un provider cloud gratuito (es. Groq o Gemini), un provider
  cloud a pagamento. Il modello deve restituire un intento strutturato
  (JSON validato con uno schema), mai eseguire azioni direttamente
- Conferma vocale per le azioni distruttive ("svuota la lista")
- Esempi da supportare: "aggiungi latte e uova alla spesa", "cosa manca
  da comprare?", "togli il pane", "timer pasta dieci minuti", "quanto
  manca al timer?", "ferma il timer", "ricordami domani alle nove di
  chiamare l'idraulico", "quando scade il bollo?", "segna che ho pagato
  la bolletta della luce"

## Funzionalità

### Lista della spesa
- Aggiunta rapida, spunta, categorie/reparti, suggerimenti dagli articoli
  frequenti
- **Offline sul telefono** (al supermercato il segnale è scarso): coda di
  modifiche in IndexedDB, sincronizzazione al ritorno della rete,
  gestione dei conflitti semplice e documentata
- Realtime tra dispositivi

### Timer
- Più timer contemporanei, con nome ("pasta", "forno")
- Gestiti localmente sul Pi, con suono di allarme e arresto vocale
- Visibili anche nella PWA, se il Pi è online

### Promemoria
- Data e ora, ricorrenze (giornaliera, settimanale, mensile, personalizzata)
- Annunciati a voce da Roby sul Pi e inviati come notifica push al telefono

### Scadenze
- Bollette, bollo e revisione auto, assicurazioni, manutenzione caldaia,
  abbonamenti
- Ricorrenze lunghe, anticipo di notifica configurabile per elemento,
  rinnovo automatico della scadenza successiva quando segno "fatto"

### Casa condivisa
- Più membri con gli stessi dati, invito tramite link
- Il Pi è un "dispositivo" della casa, abbinato una sola volta con un
  codice, con permessi limitati a ciò che gli serve

## Second brain (fase successiva, ma prevedi già schema e interfacce)
Un archivio di informazioni domestiche che catturo a voce o dal telefono
e ritrovo con domande libere:
- "Ricorda che la chiave di scorta è da mia madre" → "Dove sta la chiave
  di scorta?"
- "Ho cambiato il filtro della caldaia" → "Quando ho cambiato il filtro?"
- Note, garanzie, codici, informazioni sulla casa

Implementazione:
- Tabella note su Supabase con **pgvector** per la ricerca semantica
- Embedding generati con un modello **locale e gratuito** multilingue
  (proponi quale, sul Pi o in una Edge Function)
- Risposte generate dal modello linguistico configurato, basate solo
  sulle note trovate, con indicazione della nota di origine; se non c'è
  un modello configurato, Roby legge la nota più pertinente
- Proponi come catturare contenuti anche dal telefono (es. Web Share
  Target su Android)

## Notifiche
- Web Push con chiavi VAPID, funzionanti anche su iOS con la PWA
  installata nella schermata home
- Job pianificato (pg_cron + Edge Function) per promemoria e scadenze;
  niente segreti nel client

## Database e sicurezza
- Schema come migrazioni Supabase: case, membri, dispositivi, spesa,
  timer (se utile persisterli), promemoria, scadenze, note, sottoscrizioni
  push
- Row Level Security su tutte le tabelle
- Nessuna chiave privata nel client; chiavi dei provider opzionali solo
  lato server o sul Pi

## Interfaccia

### Postazione di casa (schermo 10,5", 3:2, 1920×1280)
Niente pagine né navigazione: **un unico layout** in cui cambia solo la
parte centrale in base al contesto.
- **Elementi fissi**: Roby (volto animato, sempre presente), ora, stato
  del microfono, indicatori discreti (timer attivi, rete)
- **Area centrale dinamica**, scelta da un motore di priorità:
  1. timer che sta suonando
  2. risposta alla richiesta appena fatta (es. "cosa manca?" → la lista
     della spesa), che resta per qualche decina di secondi e poi sparisce
  3. timer attivi con conto alla rovescia
  4. promemoria imminente o scadenza vicina
  5. a riposo: un **monoscopio** originale disegnato da noi, con orologio
- Roby cambia espressione in base al contesto: in ascolto, sta pensando,
  risponde, preoccupato per una scadenza, contento a lista vuota,
  addormentato di notte, sorpreso per un nuovo elemento
- Leggibile da qualche metro: testi grandi, un'informazione alla volta
- Estetica anni '70-'80: filtro CRT leggero (scanline, curvatura,
  bagliore), transizioni dell'area centrale con un breve effetto "neve"
- Di notte: schermata "fine delle trasmissioni" e spegnimento del pannello
- Deve restare fluida su Chromium in kiosk su Raspberry Pi 5

### PWA sul telefono
- Navigazione tra sezioni (spesa, timer, promemoria, scadenze, note) con
  un menu o una barra inferiore
- Una schermata iniziale riassuntiva con le cose rilevanti del momento
- Campo di input unico in linguaggio naturale ("latte e uova"), che usa
  lo stesso interprete del Pi, più un tasto "premi e parla" basato sulla
  Web Speech API del browser
- Roby presente in forma ridotta (stati vuoti, conferme, onboarding)

## Roby come componente riutilizzabile
- Estrai il sistema di espressioni in `packages/roby-face`: web component
  (es. `<roby-face>`) senza dipendenze dall'app
- API: impostare l'espressione, stati "in ascolto / pensa / parla",
  sincronizzazione della bocca con l'audio (anche approssimativa, in base
  al volume), eventi
- Documentato e pubblicabile come pacchetto separato

## Hardware (per documentazione e test)
- Raspberry Pi 5 (8 GB), Raspberry Pi OS Lite, compositor leggero (cage
  o labwc), Chromium kiosk
- Monitor portatile 10,5" 1920×1280 via Mini-HDMI, audio tramite HDMI
  sugli altoparlanti del monitor
- Microfono: array USB (es. ReSpeaker) o microfono USB di qualità
- Tasti originali del TV collegabili ai GPIO: almeno uno per silenziare
  il microfono, uno per "premi e parla" come alternativa alla parola di
  attivazione (mappati con l'overlay `gpio-key`)
- In `device/`: installazione, servizi systemd per voice, brain e kiosk,
  riavvio automatico, spegnimento notturno dello schermo, aggiornamento
  del software

## Suggerimenti che ti chiedo
Proponimi idee nuove, soprattutto:
- come riutilizzare `roby-face` e la catena vocale **in altri progetti**,
  anche con un possibile ritorno economico (es. volto animato da
  integrare in chatbot o siti, con temi e licenza commerciale; mascotte
  per altre mie app)
- funzioni domestiche che sfruttano bene la voce e lo schermo
- miglioramenti all'architettura o scelte alternative motivate

Per ogni idea indica impegno stimato, valore e rischi.

## Piano a fasi (proposta, rivedila)
1. Schema database, autenticazione, casa condivisa
2. `packages/intents` con test estesi, usato da un input testuale
3. PWA: sezioni, offline, realtime, notifiche push
4. Vista casa con layout adattivo, `roby-face`, monoscopio
5. Sul Pi: `brain` con cache locale e timer, poi `voice`
6. Installazione completa del Raspberry
7. Second brain
8. Ripiego con modello linguistico configurabile

## Qualità
- TypeScript rigoroso; Python tipizzato per il servizio voce
- Test per interprete dei comandi (molti esempi di frasi reali, anche
  sbagliate o ambigue), date e ricorrenze, sincronizzazione offline
- Registro locale delle frasi non capite, per migliorare le regole
- README con setup locale, variabili d'ambiente, deploy e installazione
  del Raspberry
