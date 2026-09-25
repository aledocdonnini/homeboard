"use client";

import { useState } from "react";
import { zonedDate } from "@shared/recurrence";
import { useRows } from "@/lib/useRows";
import { open, type Deadline } from "@/features/deadlines/due";
import { hhmm, onDay, type Reminder } from "@/features/reminders/schedule";
import { arrange } from "@/features/shopping/items";
import { useShoppingList } from "@/features/shopping/useShoppingList";
import Cruscotto, { type DashData } from "@/features/tv/Cruscotto";

const toDate = (day: string) => {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
};

// La home della PWA: il cruscotto con i dati veri della casa.
export default function Today({ householdId, tz }: { householdId: string; tz: string }) {
  const list = useShoppingList(householdId);
  const reminders = useRows<Reminder>("reminders", householdId).rows ?? [];
  const deadlines = useRows<Deadline>("deadlines", householdId).rows ?? [];
  const [now] = useState(() => new Date());
  const today = zonedDate(now, tz);
  const time = new Intl.DateTimeFormat("it-IT", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(now);
  const { groups, checked } = arrange(list.items);

  const data: DashData = {
    deadlines: open(deadlines, today).map(({ deadline: d, daysLeft }) => ({ title: d.title, due: toDate(d.due_date), daysLeft })),
    // Oggi, da adesso in poi: quelli già passati non servono più.
    reminders: onDay(reminders, today).filter((r) => hhmm(r.at_time) >= time)
      .map((r) => ({ time: hhmm(r.at_time), title: r.title, note: r.note ?? undefined })),
    shopping: { todo: groups.flatMap((g) => g.items.map((i) => i.name)), inCart: checked.map((i) => i.name) },
  };
  return <Cruscotto data={data} />;
}
