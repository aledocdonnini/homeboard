"use client";

import { useState } from "react";
import { useRows } from "@/lib/useRows";
import Ask from "@/features/assistant/Ask";
import { useAssistant } from "@/features/assistant/useAssistant";
import type { Deadline } from "@/features/deadlines/due";
import type { Reminder } from "@/features/reminders/schedule";
import { useShoppingList } from "@/features/shopping/useShoppingList";
import { useTimers } from "@/features/timers/useTimers";
import Cruscotto from "@/features/home/Cruscotto";
import { toDashData } from "./dashData";

// La home della PWA sul telefono: il cruscotto con i dati veri della casa, e il campo per chiedere a Roby.
// Sul computer al suo posto c'è la postazione (features/casa/DesktopStation).
export default function Today({ householdId, tz }: { householdId: string; tz: string }) {
  const list = useShoppingList(householdId);
  const reminders = useRows<Reminder>("reminders", householdId);
  const deadlines = useRows<Deadline>("deadlines", householdId);
  const { timers } = useTimers(householdId);
  const [now] = useState(() => new Date());
  const assistant = useAssistant({
    householdId, tz, list, reminders: reminders.rows ?? [], deadlines: deadlines.rows ?? [], timers: timers ?? [],
    reload: () => { void reminders.reload(); void deadlines.reload(); },
  });
  return (
    <Cruscotto
      data={toDashData(list.items, reminders.rows ?? [], deadlines.rows ?? [], tz, now)}
      ask={<Ask assistant={assistant} />}
    />
  );
}
