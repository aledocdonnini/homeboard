import { zonedDate } from "@homeboard/core/recurrence";
import { open, type Deadline } from "@/features/deadlines/due";
import { hhmm, onDay, type Reminder } from "@/features/reminders/schedule";
import { arrange, type Item } from "@homeboard/core/items";
import type { DashData } from "@/features/home/Cruscotto";

const toDate = (day: string) => {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
};

/** Dalle righe della casa a ciò che mostra il cruscotto (PWA e TV). */
export function toDashData(items: Item[], reminders: Reminder[], deadlines: Deadline[], tz: string, now: Date): DashData {
  const today = zonedDate(now, tz);
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now);
  const { groups, checked } = arrange(items);
  return {
    deadlines: open(deadlines, today).map(({ deadline: d, daysLeft }) => ({ title: d.title, due: toDate(d.due_date), daysLeft })),
    // Oggi, da adesso in poi: quelli già passati non servono più.
    reminders: onDay(reminders, today).filter((r) => hhmm(r.at_time) >= time)
      .map((r) => ({ time: hhmm(r.at_time), title: r.title, note: r.note ?? undefined })),
    shopping: { todo: groups.flatMap((g) => g.items.map((i) => i.name)), inCart: checked.map((i) => i.name) },
  };
}
