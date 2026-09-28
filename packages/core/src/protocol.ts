// Protocollo della postazione di casa (Raspberry). Solo tipi: nessuna logica.
//
//   voice (Python) ──socket Unix, JSON a righe──▶ brain (Node) ──WebSocket ws://127.0.0.1──▶ /casa (Chromium)
//
// - voice fa solo audio: parola di attivazione, fine frase, trascrizione, sintesi. A brain passa testo, mai audio.
// - brain decide ed esegue (intents, SQLite, Supabase, timer) e dice a /casa cosa mostrare.
// - /casa è una vista: non scrive niente, mostra l'ultimo stato ricevuto.
// Il gemello Python dei messaggi voice ⇄ brain è services/voice/roby_voice/protocol.py: vanno cambiati insieme.

import type { PlainDate } from "./recurrence.ts";

// ——— brain → /casa ———————————————————————————————————————————————————————————

/** Cosa sta facendo Roby: guida l'espressione e l'indicatore del microfono. */
export type Activity = "idle" | "listening" | "thinking" | "speaking";

export type HomeTimer = {
  id: string;
  label: string | null;
  durationS: number;
  /** ISO: la vista calcola da sola il conto alla rovescia. */
  endsAt: string;
  status: "running" | "ringing";
};

/** Cosa mostrare come risposta a una richiesta ("cosa manca?" → la lista). Resta qualche decina di secondi. */
export type AnswerPanel =
  | { kind: "text" }
  | { kind: "shopping"; items: string[] }
  | { kind: "reminder"; title: string; date: PlainDate; time: string }
  | { kind: "deadline"; title: string; due: PlainDate }
  | { kind: "note"; body: string }
  // Viste chieste a voce ("mostrami i promemoria"). Oggi, timer e scadenze si disegnano dallo stato, sempre aggiornato;
  // promemoria e note portano i loro dati (lo stato ha solo quelli delle prossime 24 ore, e niente note).
  | { kind: "today" }
  | { kind: "timers" }
  | { kind: "deadlines" }
  | { kind: "reminders"; items: { title: string; at: string }[] }
  | { kind: "notes"; items: { body: string; when: string }[] };

export type Answer = { id: string; said: string; reply: string; panel: AnswerPanel; at: string };

export type HomeState = {
  /** null finché il Pi non è abbinato a una casa: allora /casa mostra il codice. */
  household: { name: string; timezone: string; nightStart: string; nightEnd: string } | null;
  pairing: { code: string; expiresAt: string } | null;
  /** brain raggiunge Supabase. Offline il Pi funziona lo stesso, sulla copia locale. */
  online: boolean;
  mic: "on" | "muted";
  activity: Activity;
  timers: HomeTimer[];
  answer: Answer | null;
  shopping: string[];
  reminders: { title: string; at: string }[];
  deadlines: { title: string; due: PlainDate }[];
  /** Un elemento appena aggiunto da qualcuno (Roby sorpreso per qualche secondo). */
  arrivedAt: string | null;
};

export type ToHome =
  | { type: "state"; state: HomeState }
  /** Volume della voce di Roby, 0..1, ~30 al secondo: muove la bocca. null = torna alle sillabe finte. */
  | { type: "level"; value: number | null };

// ——— voice ⇄ brain ————————————————————————————————————————————————————————————

export type VoiceToBrain =
  /** Parola di attivazione o tasto "premi e parla": Roby ascolta. */
  | { type: "wake"; by: "word" | "button" }
  /** Frase finita (VAD) e trascritta. */
  | { type: "heard"; text: string; engine: string; ms: number }
  /** Ascolto finito senza frase utile (silenzio o rumore). */
  | { type: "nothing" }
  | { type: "speaking"; id: string }
  | { type: "level"; value: number }
  | { type: "spoken"; id: string; interrupted: boolean }
  | { type: "mic"; muted: boolean };

export type BrainToVoice =
  | { type: "say"; id: string; text: string; /** Dopo aver parlato ascolta subito (es. "Confermi?"). */ listen?: boolean }
  | { type: "stop" }
  | { type: "alarm"; on: boolean };
