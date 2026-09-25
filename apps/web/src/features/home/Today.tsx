"use client";

import { arrange } from "@/features/shopping/items";
import { useShoppingList } from "@/features/shopping/useShoppingList";
import Cruscotto, { type DashData } from "@/features/tv/Cruscotto";

// La home della PWA: il cruscotto con i dati veri della casa.
export default function Today({ householdId }: { householdId: string }) {
  const list = useShoppingList(householdId);
  const { groups, checked } = arrange(list.items);
  const data: DashData = {
    // ponytail: scadenze e promemoria arrivano con la fase 5; fino ad allora i moduli mostrano lo stato vuoto.
    deadlines: [],
    reminders: [],
    shopping: { todo: groups.flatMap((g) => g.items.map((i) => i.name)), inCart: checked.map((i) => i.name) },
  };
  return <Cruscotto data={data} />;
}
