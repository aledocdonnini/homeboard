"use client";

import { useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/localdb";
import { supabase } from "@/lib/supabase";
import { change, errorKey, pendingCount, receive, sync } from "./engine";
import { guessCategory, normalize, positionBetween, type Item } from "./items";
import type { Op } from "./sync";

// Lista della casa letta dalla copia locale (funziona offline). Le modifiche vanno in coda e partono con la rete;
// il realtime e i ritorni in primo piano tengono la copia allineata. Regole dei conflitti in sync.ts.
export function useShoppingList(householdId: string) {
  const items = useLiveQuery(() => db.items.where("household_id").equals(householdId).toArray(), [householdId]);
  const stats = useLiveQuery(() => db.stats.where("household_id").equals(householdId).reverse().sortBy("uses"), [householdId]) ?? [];
  const pending = useLiveQuery(() => pendingCount(householdId), [householdId]) ?? 0;
  const error = useLiveQuery(() => db.meta.get(errorKey(householdId)), [householdId])?.value ?? "";
  // null = mai scaricata; undefined = ancora in lettura.
  const synced = useLiveQuery(async () => (await db.meta.get(`pull:${householdId}`)) ?? null, [householdId]);

  useEffect(() => {
    const go = () => void sync(householdId);
    const channel = supabase
      .channel(`shopping:${householdId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "shopping_items", filter: `household_id=eq.${householdId}` },
        (payload) => payload.new && "id" in payload.new && void receive(householdId, [payload.new as Item]))
      .subscribe((status) => status === "SUBSCRIBED" && go());
    // Su mobile il socket cade in background: al ritorno in primo piano e della rete si risincronizza.
    const onVisible = () => document.visibilityState === "visible" && go();
    // ponytail: niente Background Sync (Safari non c'è); se restano modifiche in coda si riprova ogni 30 s.
    const retry = setInterval(async () => navigator.onLine && (await pendingCount(householdId)) > 0 && go(), 30_000);
    addEventListener("online", go);
    document.addEventListener("visibilitychange", onVisible);
    go();
    return () => {
      clearInterval(retry);
      removeEventListener("online", go);
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
    };
  }, [householdId]);

  const live = (items ?? []).filter((i) => !i.deleted_at);
  const update = (id: string, patch: Extract<Op, { kind: "update" }>["patch"]) =>
    change(householdId, [{ kind: "update", itemId: id, patch }]);

  /** Aggiunge dei nomi. Se una cosa è già in lista non la duplica; se era spuntata la rimette da comprare. */
  function add(names: string[]) {
    const ops: Op[] = [];
    const added: Item[] = [];
    for (const name of names) {
      const n = normalize(name);
      const existing = live.find((i) => normalize(i.name) === n);
      if (existing) {
        if (existing.checked) ops.push({ kind: "update", itemId: existing.id, patch: { checked: false } });
        continue;
      }
      if (added.some((r) => normalize(r.name) === n)) continue;
      const category = guessCategory(name, stats);
      const last = Math.max(-1, ...[...live, ...added].filter((i) => i.category === category).map((i) => i.position));
      const row = { id: crypto.randomUUID(), household_id: householdId, name, category, position: positionBetween(last) };
      added.push({ ...row, checked: false, updated_at: "", deleted_at: null });
      ops.push({ kind: "insert", itemId: row.id, row });
    }
    if (ops.length) void change(householdId, ops);
  }

  return {
    items: live,
    stats,
    error,
    pending,
    /** Pronta quando c'è la copia locale e almeno un download riuscito (o non c'è rete per farlo). */
    loaded: items !== undefined && synced !== undefined && (!!synced || live.length > 0 || !navigator.onLine),
    add,
    clearChecked: () => {
      const now = new Date().toISOString();
      const ops: Op[] = live.filter((i) => i.checked).map((i) => ({ kind: "update", itemId: i.id, patch: { deleted_at: now } }));
      if (ops.length) void change(householdId, ops);
    },
    setChecked: (id: string, checked: boolean) => update(id, { checked }),
    setCategory: (id: string, category: string) => update(id, { category }),
    /** Sposta fra due vicini dello stesso reparto (undefined = in cima / in fondo). */
    move: (id: string, before?: Item, after?: Item) => update(id, { position: positionBetween(before?.position, after?.position) }),
  };
}
