"use client";

import { useState } from "react";
import { useRows } from "@/lib/useRows";
import type { Deadline } from "@/features/deadlines/due";
import type { Reminder } from "@/features/reminders/schedule";
import { useShoppingList } from "@/features/shopping/useShoppingList";
import Cruscotto from "@/features/tv/Cruscotto";
import { toDashData } from "./dashData";

// La home della PWA: il cruscotto con i dati veri della casa.
export default function Today({ householdId, tz }: { householdId: string; tz: string }) {
  const list = useShoppingList(householdId);
  const reminders = useRows<Reminder>("reminders", householdId).rows ?? [];
  const deadlines = useRows<Deadline>("deadlines", householdId).rows ?? [];
  const [now] = useState(() => new Date());
  return <Cruscotto data={toDashData(list.items, reminders, deadlines, tz, now)} />;
}
