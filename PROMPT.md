# Progetto: app domestica per spesa, promemoria e scadenze + TV Crezar + Roby

## Contesto

Sono Alessandro, sviluppatore web (Next.js, Astro, Nuxt, Supabase, Vercel,
Netlify, Stripe). È un progetto personale: costi a zero o quasi (free tier
di Supabase e Vercel), ma voglio un risultato curato, da portfolio.

L'obiettivo è un'unica applicazione con tre "facce":

1. **PWA mobile** per gestire lista della spesa, promemoria e scadenze,
   anche fuori casa, con notifiche push.
2. **Vista TV** a schermo intero, in sola lettura, che gira su un Raspberry Pi
   dentro la scocca di un televisore portatile Crezar anni '70 (tubo
   catodico sostituito da un monitor moderno).
3. **Roby**, un mio progetto esistente: un volto animato con un sistema di
   espressioni, che qui diventa la "voce" della TV e annuncia le cose.
   Codice attuale: /Users/alessandrodonnini/Repos/roby. Demo: roby-bot.vercel.app.

Prima di scrivere codice, leggi il codice di Roby, proponimi un'architettura
e un piano a fasi, e fammi le domande che ti servono. Procedi una fase alla
volta e aspetta la mia conferma prima di passare alla successiva.

## Stack di partenza (proponi alternative motivate se servono)

- Next.js (App Router) + TypeScript, deploy su Vercel
- Supabase: Postgres, Auth, Realtime, Edge Functions, pg_cron
- PWA con service worker (es. Serwist), IndexedDB per l'offline (es. Dexie)
- Interfaccia in italiano

## Funzionalità

### Lista della spesa

- Aggiunta rapida, spunta, riordino, categorie/reparti
- Suggerimenti dagli articoli usati più spesso
- **Deve funzionare offline** (al supermercato il segnale è scarso): coda
  di modifiche locale, sincronizzazione al ritorno della rete, gestione
  dei conflitti semplice e documentata
- Aggiornamenti in realtime tra dispositivi

### Promemoria

- Data e ora, ricorrenze (giornaliera, settimanale, mensile, personalizzata)
- Notifica push all'orario

### Scadenze

- Esempi: bollette, bollo e revisione auto, assicurazioni, manutenzione
  caldaia, abbonamenti
- Ricorrenze lunghe (ogni anno, ogni due anni), anticipo di notifica
  configurabile per elemento (es. 30 giorni, 7 giorni, il giorno stesso)
- Stato: da fare, fatta (con rinnovo automatico della successiva se ricorrente)

### Casa condivisa

- Concetto di "casa" con più membri che condividono liste e scadenze
- Invito tramite link

## Notifiche

- Web Push con chiavi VAPID; devono funzionare anche su iOS con la PWA
  installata nella schermata home
- Tabella per le sottoscrizioni push per dispositivo
- Job pianificato con pg_cron + Edge Function che controlla promemoria e
  scadenze e invia le notifiche; niente segreti nel client

## Database e sicurezza

- Proponi lo schema (case, membri, elementi di spesa, promemoria, scadenze,
  sottoscrizioni push, dispositivi) come migrazioni Supabase
- Row Level Security su tutte le tabelle
- La TV non deve avere un login interattivo: prevedi un "dispositivo"
  associato alla casa con permessi di sola lettura, attivabile una volta
  sola (es. codice di abbinamento)

## Vista TV (/tv)

- Monitor previsto: 10,5" in formato 3:2, 1920×1280; leggibile a distanza,
  numeri e testi grandi, una informazione alla volta
- Mostra la cosa più rilevante del momento (scadenza vicina, promemoria
  imminente, lista della spesa); se non c'è niente, va in onda un
  **monoscopio** originale disegnato da noi, con orologio
- Cambio vista con i tasti da 1 a 6 della tastiera: sul Raspberry i sei
  tasti di preselezione originali del TV saranno collegati ai GPIO e
  mappati come tasti con l'overlay `gpio-key`
- Estetica anni '70-'80: filtro CRT (scanline, leggera curvatura,
  bagliore) in CSS o WebGL leggero, effetto "neve" con fruscio al cambio
  canale, numero del canale in stile OSD in un angolo
- Di notte: schermata "fine delle trasmissioni" e spegnimento del pannello
  (lato Raspberry, con uno script)
- Deve girare fluido su Chromium in modalità kiosk su un Raspberry Pi 4

## Setup Raspberry Pi

Prepara una cartella `device/` con documentazione e script per:

- Raspberry Pi OS Lite + compositor leggero (cage o labwc) + Chromium kiosk
  avviato al boot con systemd
- Configurazione `gpio-key` in `config.txt` per i sei tasti
- Spegnimento e riaccensione pianificati dello schermo
- Ripresa automatica in caso di crash o perdita di rete

## Roby

- Estrai il sistema di espressioni di Roby in un **web component
  riutilizzabile e indipendente** (es. `<roby-face>`), con un'API chiara:
  impostare l'espressione, "parlare" un testo (sintesi vocale del browser,
  gratuita), eventi per inizio e fine parlato
- Pubblicabile come pacchetto separato, senza dipendenze dall'app
- Nella vista TV, mappa lo stato dei dati sulle espressioni: preoccupato
  per una scadenza vicina, contento con la lista vuota, addormentato di
  notte, sorpreso all'arrivo di un nuovo elemento
- L'input vocale ("aggiungi il pane") è una fase successiva: progettalo
  ma non implementarlo subito

## Suggerimenti che ti chiedo

Oltre a quanto sopra, proponimi idee nuove, soprattutto su come
riutilizzare il web component di Roby **in altri progetti**, anche con un
possibile ritorno economico. Alcuni spunti da valutare e ampliare:

- Roby come mascotte anche nella PWA (stati vuoti, conferme, onboarding)
- Aggiunta in linguaggio naturale ("latte e uova domani") con regole
  semplici o un modello gratuito
- Il web component come prodotto a sé: volto animato da integrare in
  chatbot, siti o assistenti esistenti, con temi e licenza commerciale
- Riuso in un altro mio progetto (es. una PWA per runner) come mascotte

Per ogni idea indica impegno stimato, valore e rischi.

## Qualità

- TypeScript rigoroso, codice organizzato per funzionalità
- Test per la logica di sincronizzazione offline e per il calcolo delle
  ricorrenze e delle notifiche
- README con setup locale, variabili d'ambiente, deploy e configurazione
  del Raspberry
