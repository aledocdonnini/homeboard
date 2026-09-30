"use client";

import { useState } from "react";
import type { Answer, AnswerPanel } from "@homeboard/core/protocol";
import { addDays, describe, nextReminderAt, zonedDate } from "@homeboard/core/recurrence";
import { secondsLeft, spoken } from "@homeboard/core/timers";
import { DESTRUCTIVE, Intent, parse, sameThing, smalltalkReply, type Context } from "@homeboard/intents";
import { supabase } from "@/lib/supabase";
import { nextDue, open, shortDate, whenLabel, type Deadline } from "@/features/deadlines/due";
import { dayLabel, upcoming, type Reminder } from "@/features/reminders/schedule";
import type { useShoppingList } from "@/features/shopping/useShoppingList";
import type { Timer } from "@/features/timers/useTimers";
import * as spotify from "@/lib/spotify";

export type View = Extract<Intent, { type: "show" }>["view"];
export type Reply = {
  text: string;
  /** La sezione della risposta: sul telefono ci si va (le viste la aprono da sole). */
  href?: string;
  /** Cosa mostrare al centro sul computer (come /casa sulla TV). */
  panel?: AnswerPanel;
  tone?: "ok" | "question" | "error";
  /** Una vista chiesta ("mostrami la spesa"): sul telefono si apre la sezione invece di rispondere. */
  go?: boolean;
};

type Deps = {
  householdId: string;
  tz: string;
  list: ReturnType<typeof useShoppingList>;
  reminders: Reminder[];
  deadlines: Deadline[];
  timers: Timer[];
  reload: () => void;
  /** Dopo un comando musicale: aggiorna subito "cosa suona" (la postazione sul computer). */
  refreshMusic?: () => void;
};

export const HREF: Record<View, string> = {
  today: "/", shopping: "/spesa", timers: "/timer", reminders: "/promemoria", deadlines: "/scadenze", notes: "/note", settings: "/impostazioni",
};

/** false quando il server ha detto che il modello linguistico è spento (501): non si chiede più. */
let llmAvailable = true;

/**
 * Frase non capita dalle regole: la si chiede al modello linguistico sul server (/api/interpreta), se c'è.
 * La risposta si rivalida con lo schema anche qui. Senza rete o senza modello resta non capita.
 */
async function askServer(text: string, ctx: Context): Promise<Intent | null> {
  if (!llmAvailable) return null;
  try {
    const { data } = await supabase.auth.getSession();
    const res = await fetch("/api/interpreta", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
      body: JSON.stringify({ text, timezone: ctx.timezone, timers: ctx.timers, deadlines: ctx.deadlines }),
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 501) llmAvailable = false;
    if (!res.ok) return null;
    const checked = Intent.safeParse(((await res.json()) as { intent?: unknown }).intent);
    return checked.success && checked.data.type !== "unknown" ? checked.data : null;
  } catch {
    return null;
  }
}

// "latte, uova e pane"
const and = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} e ${xs.at(-1)}`);
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const count = (n: number, one: string, many: string) => (n === 1 ? `1 ${one}` : `${n} ${many}`);

/**
 * Il campo unico della PWA: la stessa interpretazione del Raspberry (@homeboard/intents), eseguita con i moduli
 * della PWA. La spesa funziona anche offline (coda); promemoria, scadenze e note chiedono la rete.
 * Le azioni distruttive aspettano un "sì". Ogni risposta porta il suo pannello, per la postazione sul computer.
 */
export function useAssistant({ householdId, tz, list, reminders, deadlines, timers, reload, refreshMusic }: Deps) {
  const [reply, setReply] = useState<Reply | null>(null);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [pending, setPending] = useState<Intent | null>(null);
  const [busy, setBusy] = useState(false);

  const shoppingItems = () => list.items.filter((i) => !i.checked).map((i) => i.name);

  function respond(said: string, r: Reply) {
    setReply(r);
    setAnswer({ id: crypto.randomUUID(), said, reply: r.text, panel: r.panel ?? { kind: "text" }, at: new Date().toISOString() });
  }

  /** Una vista, come se la si fosse chiesta: sul computer la apre al centro (anche senza dire niente). */
  async function view(v: View, said = ""): Promise<Reply> {
    const now = new Date(), today = zonedDate(now, tz);
    const soon = upcoming(reminders, now, tz).next.filter((u) => u.at.getTime() - now.getTime() < 14 * 86_400_000);
    const openDeadlines = open(deadlines, today);
    switch (v) {
      case "shopping": {
        const items = shoppingItems();
        return { text: items.length ? `Da prendere: ${count(items.length, "cosa", "cose")}.` : "La lista è vuota.", panel: { kind: "shopping", items }, href: HREF.shopping, go: true };
      }
      case "timers":
        return { text: timers.length ? `${count(timers.length, "timer attivo", "timer attivi")}.` : "Nessun timer attivo.", panel: { kind: "timers" }, href: HREF.timers, go: true };
      case "reminders":
        return {
          text: soon.length ? `${count(soon.length, "promemoria", "promemoria")} nei prossimi giorni.` : "Nessun promemoria in programma.",
          panel: { kind: "reminders", items: soon.slice(0, 10).map((u) => ({ title: u.reminder.title, at: u.at.toISOString() })) },
          href: HREF.reminders, go: true,
        };
      case "deadlines":
        return { text: openDeadlines.length ? `${count(openDeadlines.length, "scadenza", "scadenze")}.` : "Nessuna scadenza in vista.", panel: { kind: "deadlines" }, href: HREF.deadlines, go: true };
      case "notes": {
        const { data } = await supabase.from("notes").select("body, created_at").eq("household_id", householdId)
          .is("deleted_at", null).order("created_at", { ascending: false }).limit(8);
        const items = (data ?? []).map((n) => ({ body: n.body, when: new Date(n.created_at).toLocaleDateString("it-IT", { timeZone: tz, day: "numeric", month: "long" }) }));
        return { text: items.length ? "Ecco le ultime note." : "Non ci sono note.", panel: { kind: "notes", items }, href: HREF.notes, go: true };
      }
      case "settings":
        return { text: "Apro le impostazioni.", href: HREF.settings, go: true };
      case "today":
        return { text: said ? "Ecco la giornata." : "", panel: { kind: "today" }, href: HREF.today, go: true };
    }
  }

  async function ask(text: string) {
    if (!text.trim()) return;
    const now = new Date(), today = zonedDate(now, tz);
    const openDeadlines = open(deadlines, today);
    const ctx: Context = {
      now, timezone: tz, bareIsShopping: true,
      deadlines: openDeadlines.map((d) => d.deadline.title),
      timers: timers.flatMap((t) => (t.label ? [t.label] : [])),
    };
    let intent = parse(text, ctx);
    if (intent.type === "unknown" && !pending) {
      setBusy(true);
      const guessed = await askServer(text, ctx);
      setBusy(false);
      if (guessed) {
        intent = guessed;
        // Le regole non l'hanno capita: nel registro comunque, per migliorarle.
        void supabase.from("unparsed_log").insert({ household_id: householdId, text: text.slice(0, 500), source: "pwa" }).then(() => {});
      }
    }

    if (pending) {
      setPending(null);
      if (intent.type === "confirm") return respond(text, await run(pending));
      if (intent.type === "cancel") return respond(text, { text: "Va bene, lascio stare." });
    }
    if (DESTRUCTIVE.has(intent.type)) {
      setPending(intent);
      return respond(text, { text: "Tolgo tutto dalla lista della spesa? Scrivi sì o no.", tone: "question" });
    }
    setBusy(true);
    try {
      respond(text, await run(intent));
    } catch {
      respond(text, { text: "Non riesco a salvarlo: serve la rete. Riprova tra poco.", tone: "error" });
    } finally {
      setBusy(false);
    }

    async function run(intent: Intent): Promise<Reply> {
      switch (intent.type) {
        case "shopping.add":
          list.add(intent.items);
          return {
            text: `Aggiunt${intent.items.length > 1 ? "i" : "o"}: ${and(intent.items.map(lower))}.`, href: "/spesa",
            panel: { kind: "shopping", items: [...new Set([...shoppingItems(), ...intent.items])] },
          };
        case "shopping.remove": {
          const found = intent.items.map((name) => list.items.find((i) => !i.checked && sameThing(name, i.name)));
          const ids = found.filter((i) => i !== undefined).map((i) => i.id);
          list.remove(ids);
          const missing = intent.items.filter((_, k) => !found[k]);
          const panel: AnswerPanel = { kind: "shopping", items: list.items.filter((i) => !i.checked && !ids.includes(i.id)).map((i) => i.name) };
          if (!ids.length) return { text: `Non trovo ${and(missing.map(lower))} nella lista.`, href: "/spesa", panel };
          return { text: `Tolt${ids.length > 1 ? "i" : "o"} dalla lista.${missing.length ? ` Non c'era: ${and(missing.map(lower))}.` : ""}`, href: "/spesa", panel };
        }
        case "shopping.list": {
          const todo = shoppingItems();
          return { text: todo.length ? `Da prendere: ${and(todo.map(lower))}.` : "La lista è vuota.", href: "/spesa", panel: { kind: "shopping", items: todo } };
        }
        case "shopping.clear":
          list.clearAll();
          return { text: "Fatto: la lista è vuota.", href: "/spesa", panel: { kind: "shopping", items: [] } };

        case "timer.query": {
          // Si leggono dalla copia in Supabase; metterli e fermarli resta a Roby, che suona in casa.
          const found = intent.label ? timers.filter((t) => t.label && sameThing(intent.label!, t.label)) : timers;
          if (!found.length) return { text: intent.label ? `Nessun timer "${intent.label}".` : "Nessun timer attivo.", href: "/timer", panel: { kind: "timers" } };
          return {
            text: found.map((t) => `${t.label ? `${t.label[0]!.toUpperCase()}${t.label.slice(1)}` : "Timer"}: ${t.status === "ringing" ? "sta suonando" : `mancano ${spoken(secondsLeft(t.ends_at, now))}`}`).join(". ") + ".",
            href: "/timer", panel: { kind: "timers" },
          };
        }
        case "timer.start": case "timer.stop":
          return { text: "I timer li mette e li ferma Roby, a casa: diglielo a voce. Qui vedi quanto manca.", href: "/timer", panel: { kind: "timers" } };

        case "reminder.create": {
          const recurrence = intent.recurrence ?? null;
          const nextAt = nextReminderAt(intent.date, intent.time, recurrence, now, tz);
          const { error } = await supabase.from("reminders").insert({
            household_id: householdId, title: intent.title, start_date: intent.date, at_time: intent.time,
            recurrence, next_at: nextAt?.toISOString() ?? null,
          });
          if (error) throw error;
          reload();
          const when = recurrence ? `${lower(describe(recurrence))}, alle ${intent.time}` : `${lower(dayLabel(intent.date, today, addDays(today, 1)))} alle ${intent.time}`;
          return { text: `Te lo ricordo ${when}: ${lower(intent.title)}.`, href: "/promemoria", panel: { kind: "reminder", title: intent.title, date: intent.date, time: intent.time } };
        }

        case "deadline.query": {
          if (!intent.title) return { ...(await view("deadlines", text)), go: false };
          const matches = openDeadlines.filter((d) => sameThing(intent.title!, d.deadline.title));
          const first = matches[0];
          if (!first) return { text: `Non trovo una scadenza "${intent.title}".`, href: "/scadenze" };
          return {
            text: matches.map((d) => `${d.deadline.title}: ${d.daysLeft < 0 ? whenLabel(d.daysLeft) : `scade ${whenLabel(d.daysLeft)}`}, ${shortDate(d.deadline.due_date, today)}`).join(". ") + ".",
            href: "/scadenze", panel: { kind: "deadline", title: first.deadline.title, due: first.deadline.due_date },
          };
        }
        case "deadline.complete": {
          const d = openDeadlines.find((o) => sameThing(intent.title, o.deadline.title))?.deadline;
          if (!d) return { text: `Non trovo una scadenza "${intent.title}" da segnare.`, href: "/scadenze" };
          const next = nextDue(d);
          const { error } = await supabase.rpc("complete_deadline", { deadline: d.id, next_due: next ?? undefined });
          if (error) throw error;
          reload();
          return {
            text: `Segnata fatta: ${lower(d.title)}.${next ? ` La prossima è ${shortDate(next, today)}.` : ""}`, href: "/scadenze",
            ...(next ? { panel: { kind: "deadline" as const, title: d.title, due: next } } : {}),
          };
        }

        case "note.save": {
          const { error } = await supabase.from("notes").insert({ household_id: householdId, body: intent.body, source: "pwa" });
          if (error) throw error;
          return { text: "Me lo ricordo.", panel: { kind: "note", body: intent.body } };
        }
        case "note.ask": {
          // Per parole, in OR, sul server (full-text in italiano). La ricerca per significato la fa Roby sul Pi.
          const words = intent.question.split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2);
          const { data, error } = await supabase.from("notes").select("body").eq("household_id", householdId)
            .is("deleted_at", null).textSearch("tsv", words.join(" or "), { config: "italian", type: "websearch" })
            .order("created_at", { ascending: false }).limit(1);
          if (error) throw error;
          return data[0]
            ? { text: `Ho annotato: "${data[0].body}"`, panel: { kind: "note", body: data[0].body } }
            : { text: "Non ho niente annotato su questo." };
        }

        case "show":
          return view(intent.view, text);
        case "music":
          return music(intent);
        case "smalltalk":
          return { text: smalltalkReply(intent.topic, now, tz) };
        case "confirm": case "cancel":
          return { text: "Non c'era niente da confermare." };
        case "unknown":
          // Le frasi non capite servono a migliorare le regole: si registrano, senza fermarsi se non c'è rete.
          void supabase.from("unparsed_log").insert({ household_id: householdId, text: text.slice(0, 500), source: "pwa" }).then(() => {});
          return { text: "Non ho capito. Prova con \"aggiungi il latte\" o \"mostrami i promemoria\".", tone: "error" };
      }
    }
  }

  /** La musica con le API di Spotify (lib/spotify.ts), sullo Spotify aperto: stesse frasi di Roby sul Pi. */
  async function music(intent: Extract<Intent, { type: "music" }>): Promise<Reply> {
    if (!spotify.connected()) {
      return { text: spotify.CLIENT_ID ? "Collega Spotify dalle Impostazioni e poi riprova." : "La musica la mette Roby, a casa: diglielo a voce.", href: "/impostazioni?spotify=1" };
    }
    const done = (text: string, show = true): Reply => {
      refreshMusic?.();
      return { text, ...(show ? { panel: { kind: "music" as const } } : {}) };
    };
    try {
      switch (intent.action) {
        case "play": {
          if (!intent.query) { await spotify.resume(); return done("Riprendo."); }
          const found = await spotify.find(intent.query, intent.kind);
          if (!found) return { text: `Non trovo ${intent.query} su Spotify.` };
          await spotify.play(found.uri);
          return done(`Metto ${found.label}.`);
        }
        case "resume": await spotify.resume(); return done("Riprendo.");
        case "pause": await spotify.pause(); return done("In pausa.", false);
        case "next": await spotify.next(); return done("Avanti.");
        case "prev": await spotify.prev(); return done("Torno indietro.");
        case "louder": await spotify.setVolume(10, true); return done("Più forte.", false);
        case "quieter": await spotify.setVolume(-10, true); return done("Più piano.", false);
        case "volume": await spotify.setVolume(intent.level ?? 50); return done(`Volume a ${intent.level ?? 50}.`, false);
        case "what": {
          const now = await spotify.nowPlaying();
          return now ? done(`${now.playing ? "Sta suonando" : "In pausa"}: ${now.title} di ${now.artist}${now.device ? `, su ${now.device}` : ""}.`) : { text: "Non sta suonando niente." };
        }
      }
    } catch (e) {
      return { text: (e as Error).message.startsWith("Spotify: HTTP") ? "Spotify non risponde, riprova tra poco." : (e as Error).message, tone: "error" };
    }
  }

  return {
    reply, answer, busy, ask,
    /** Apre una vista senza che la si chieda (il link /spesa sul computer). */
    show: async (v: View) => {
      const r = await view(v);
      setAnswer({ id: crypto.randomUUID(), said: "", reply: r.text, panel: r.panel ?? { kind: "text" }, at: new Date().toISOString() });
    },
    clear: () => { setReply(null); setAnswer(null); setPending(null); },
  };
}
