"use client";

import { useState } from "react";
import { addDays, describe, nextReminderAt, zonedDate } from "@homeboard/core/recurrence";
import { DESTRUCTIVE, parse, sameThing, smalltalkReply, type Intent } from "@homeboard/intents";
import { supabase } from "@/lib/supabase";
import { nextDue, open, shortDate, whenLabel, type Deadline } from "@/features/deadlines/due";
import { dayLabel } from "@/features/reminders/schedule";
import type { useShoppingList } from "@/features/shopping/useShoppingList";
import type { Timer } from "@/features/timers/useTimers";
import { secondsLeft, spoken } from "@homeboard/core/timers";

export type Reply = { text: string; href?: string; tone?: "ok" | "question" | "error" };

type Deps = {
  householdId: string;
  tz: string;
  list: ReturnType<typeof useShoppingList>;
  deadlines: Deadline[];
  timers: Timer[];
  reload: () => void;
};

// "latte, uova e pane"
const and = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} e ${xs.at(-1)}`);
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/**
 * Il campo unico della PWA: la stessa interpretazione del Raspberry (@homeboard/intents), eseguita con i moduli
 * della PWA. La spesa funziona anche offline (coda); promemoria, scadenze e note chiedono la rete.
 * Le azioni distruttive aspettano un "sì".
 */
export function useAssistant({ householdId, tz, list, deadlines, timers, reload }: Deps) {
  const [reply, setReply] = useState<Reply | null>(null);
  const [pending, setPending] = useState<Intent | null>(null);
  const [busy, setBusy] = useState(false);

  async function ask(text: string) {
    if (!text.trim()) return;
    const now = new Date(), today = zonedDate(now, tz);
    const openDeadlines = open(deadlines, today);
    const intent = parse(text, {
      now, timezone: tz, bareIsShopping: true,
      deadlines: openDeadlines.map((d) => d.deadline.title),
      timers: timers.flatMap((t) => (t.label ? [t.label] : [])),
    });

    if (pending) {
      setPending(null);
      if (intent.type === "confirm") return setReply(await run(pending));
      if (intent.type === "cancel") return setReply({ text: "Va bene, lascio stare." });
    }
    if (DESTRUCTIVE.has(intent.type)) {
      setPending(intent);
      return setReply({ text: "Tolgo tutto dalla lista della spesa? Scrivi sì o no.", tone: "question" });
    }
    setBusy(true);
    try {
      setReply(await run(intent));
    } catch {
      setReply({ text: "Non riesco a salvarlo: serve la rete. Riprova tra poco.", tone: "error" });
    } finally {
      setBusy(false);
    }

    async function run(intent: Intent): Promise<Reply> {
      switch (intent.type) {
        case "shopping.add":
          list.add(intent.items);
          return { text: `Aggiunt${intent.items.length > 1 ? "i" : "o"}: ${and(intent.items.map(lower))}.`, href: "/spesa" };
        case "shopping.remove": {
          const found = intent.items.map((name) => list.items.find((i) => !i.checked && sameThing(name, i.name)));
          const ids = found.filter((i) => i !== undefined).map((i) => i.id);
          list.remove(ids);
          const missing = intent.items.filter((_, k) => !found[k]);
          if (!ids.length) return { text: `Non trovo ${and(missing.map(lower))} nella lista.`, href: "/spesa" };
          return { text: `Tolt${ids.length > 1 ? "i" : "o"} dalla lista.${missing.length ? ` Non c'era: ${and(missing.map(lower))}.` : ""}`, href: "/spesa" };
        }
        case "shopping.list": {
          const todo = list.items.filter((i) => !i.checked).map((i) => lower(i.name));
          return { text: todo.length ? `Da prendere: ${and(todo)}.` : "La lista è vuota.", href: "/spesa" };
        }
        case "shopping.clear":
          list.clearAll();
          return { text: "Fatto: la lista è vuota.", href: "/spesa" };

        case "timer.query": {
          // Si leggono dalla copia in Supabase; metterli e fermarli resta a Roby, che suona in casa.
          const found = intent.label ? timers.filter((t) => t.label && sameThing(intent.label!, t.label)) : timers;
          if (!found.length) return { text: intent.label ? `Nessun timer "${intent.label}".` : "Nessun timer attivo.", href: "/timer" };
          return {
            text: found.map((t) => `${t.label ? `${t.label[0]!.toUpperCase()}${t.label.slice(1)}` : "Timer"}: ${t.status === "ringing" ? "sta suonando" : `mancano ${spoken(secondsLeft(t.ends_at, now))}`}`).join(". ") + ".",
            href: "/timer",
          };
        }
        case "timer.start": case "timer.stop":
          return { text: "I timer li mette e li ferma Roby, a casa: diglielo a voce. Qui vedi quanto manca.", href: "/timer" };

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
          return { text: `Te lo ricordo ${when}: ${lower(intent.title)}.`, href: "/promemoria" };
        }

        case "deadline.query": {
          const matches = intent.title ? openDeadlines.filter((d) => sameThing(intent.title!, d.deadline.title)) : openDeadlines.slice(0, 3);
          if (!matches.length) return { text: intent.title ? `Non trovo una scadenza "${intent.title}".` : "Nessuna scadenza in vista.", href: "/scadenze" };
          return {
            text: matches.map((d) => `${d.deadline.title}: ${d.daysLeft < 0 ? whenLabel(d.daysLeft) : `scade ${whenLabel(d.daysLeft)}`}, ${shortDate(d.deadline.due_date, today)}`).join(". ") + ".",
            href: "/scadenze",
          };
        }
        case "deadline.complete": {
          const d = openDeadlines.find((o) => sameThing(intent.title, o.deadline.title))?.deadline;
          if (!d) return { text: `Non trovo una scadenza "${intent.title}" da segnare.`, href: "/scadenze" };
          const next = nextDue(d);
          const { error } = await supabase.rpc("complete_deadline", { deadline: d.id, next_due: next ?? undefined });
          if (error) throw error;
          reload();
          return { text: `Segnata fatta: ${lower(d.title)}.${next ? ` La prossima è ${shortDate(next, today)}.` : ""}`, href: "/scadenze" };
        }

        case "note.save": {
          const { error } = await supabase.from("notes").insert({ household_id: householdId, body: intent.body, source: "pwa" });
          if (error) throw error;
          return { text: "Me lo ricordo." };
        }
        case "note.ask": {
          // Per parole, in OR: "dove sta la chiave di scorta" trova la nota con "chiave" e "scorta".
          // ponytail: niente punteggio di pertinenza finché non arriva la ricerca per significato (fase 7).
          const words = intent.question.split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2);
          const { data, error } = await supabase.from("notes").select("body").eq("household_id", householdId)
            .is("deleted_at", null).textSearch("tsv", words.join(" or "), { config: "italian", type: "websearch" })
            .order("created_at", { ascending: false }).limit(1);
          if (error) throw error;
          return { text: data[0] ? `Ho annotato: "${data[0].body}"` : "Non ho niente annotato su questo." };
        }

        case "smalltalk":
          return { text: smalltalkReply(intent.topic, now, tz) };
        case "confirm": case "cancel":
          return { text: "Non c'era niente da confermare." };
        case "unknown":
          // Le frasi non capite servono a migliorare le regole: si registrano, senza fermarsi se non c'è rete.
          void supabase.from("unparsed_log").insert({ household_id: householdId, text: text.slice(0, 500), source: "pwa" }).then(() => {});
          return { text: "Non ho capito. Prova con \"aggiungi il latte\" o \"ricordami domani alle 9 di chiamare il medico\".", tone: "error" };
      }
    }
  }

  return { reply, busy, ask, clear: () => { setReply(null); setPending(null); } };
}
