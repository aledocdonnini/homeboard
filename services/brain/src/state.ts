// Lo stato che /casa mostra (HomeState, packages/core/src/protocol.ts), costruito dalla copia locale.

import type { Activity, Answer, HomeState } from "@homeboard/core/protocol";
import { nextReminderAt, type Recurrence } from "@homeboard/core/recurrence";
import { openDeadlines, shoppingList } from "./executor.ts";
import type { Row, Store } from "./store.ts";
import type { Timers } from "./timers.ts";

export type Household = { id: string; name: string; timezone: string; night_start: string; night_end: string };

/** Quello che brain sa in memoria, oltre alla copia locale. */
export type Live = {
  online: boolean;
  mic: "on" | "muted";
  activity: Activity;
  answer: Answer | null;
  arrivedAt: string | null;
  pairing: { code: string; expiresAt: string } | null;
  music?: HomeState["music"];
  musicLink?: HomeState["musicLink"];
};

const DAY_MS = 86_400_000;

/** Il prossimo istante di ogni promemoria (nel fuso della casa). */
export function upcoming(reminders: Row[], now: Date, tz: string) {
  return reminders.flatMap((r) => {
    const at = nextReminderAt(String(r.start_date), String(r.at_time).slice(0, 5), (r.recurrence ?? null) as Recurrence | null, now, tz);
    return at ? [{ title: String(r.title), at }] : [];
  }).sort((a, b) => a.at.getTime() - b.at.getTime());
}

/** Promemoria scattati fra `from` (escluso) e `to` (incluso): Roby li annuncia a voce. */
export function dueBetween(reminders: Row[], from: Date, to: Date, tz: string) {
  return upcoming(reminders, new Date(from.getTime()), tz).filter((r) => r.at <= to).map((r) => r.title);
}

export function homeState(store: Store, timers: Timers, live: Live, now: Date): HomeState {
  const h = store.get<Household>("household");
  return {
    household: h ? { name: h.name, timezone: h.timezone, nightStart: h.night_start.slice(0, 5), nightEnd: h.night_end.slice(0, 5) } : null,
    pairing: h ? null : live.pairing,
    online: live.online,
    mic: live.mic,
    activity: live.activity,
    timers: timers.list,
    answer: live.answer,
    shopping: h ? shoppingList(store) : [],
    reminders: h ? upcoming(store.live("reminders"), now, h.timezone).filter((r) => r.at.getTime() - now.getTime() < DAY_MS).map((r) => ({ title: r.title, at: r.at.toISOString() })) : [],
    deadlines: h ? openDeadlines(store).map((d) => ({ title: String(d.title), due: String(d.due_date) })) : [],
    arrivedAt: live.arrivedAt,
    music: live.music ?? null,
    musicLink: live.musicLink ?? null,
  };
}
