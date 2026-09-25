"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { guessCategory, mergeRow, normalize, positionBetween, type Item, type Stat } from "./items";

const COLUMNS = "id, household_id, name, category, checked, position, updated_at, deleted_at";
// Le righe ottimistiche nascono "vecchissime": la prima risposta del server le sostituisce sempre.
const LOCAL = "1970-01-01T00:00:00Z";

type Patch = Partial<Pick<Item, "name" | "category" | "checked" | "position" | "deleted_at">>;

// Lista della casa: fetch iniziale, realtime, e scritture ottimistiche (lo stato locale cambia subito).
// ponytail: solo online; la fase 4 mette qui sotto Dexie e la coda di modifiche offline, l'API resta questa.
export function useShoppingList(householdId: string) {
  const [items, setItems] = useState<Item[]>([]);
  const [stats, setStats] = useState<Stat[]>([]);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  const refetch = useCallback(async () => {
    const [list, sugg] = await Promise.all([
      supabase.from("shopping_items").select(COLUMNS).eq("household_id", householdId).is("deleted_at", null),
      supabase.from("shopping_item_stats").select("name_norm, name, category, uses").eq("household_id", householdId)
        .order("uses", { ascending: false }).limit(200),
    ]);
    if (list.error || sugg.error) return setError((list.error ?? sugg.error)!.message);
    setItems((prev) => list.data.reduce(mergeRow, prev));
    setStats(sugg.data);
    setLoaded(true);
  }, [householdId]);

  useEffect(() => {
    // Realtime per gli altri dispositivi; al (ri)collegamento e al ritorno in primo piano si rilegge tutto,
    // perché su mobile il socket cade quando l'app va in background.
    const channel = supabase
      .channel(`shopping:${householdId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "shopping_items", filter: `household_id=eq.${householdId}` },
        (payload) => payload.new && "id" in payload.new && setItems((prev) => mergeRow(prev, payload.new as Item)))
      .subscribe((status) => status === "SUBSCRIBED" && refetch());
    const onVisible = () => document.visibilityState === "visible" && refetch();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
    };
  }, [householdId, refetch]);

  const fail = useCallback((message: string) => {
    setError(message);
    refetch(); // torna allo stato vero del server
  }, [refetch]);

  const update = useCallback(async (id: string, patch: Patch) => {
    setError("");
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    const { data, error } = await supabase.from("shopping_items").update(patch).eq("id", id).select(COLUMNS).single();
    if (error) fail(error.message);
    else setItems((prev) => mergeRow(prev, data));
  }, [fail]);

  /** Aggiunge dei nomi. Se una cosa è già in lista non la duplica; se era spuntata la rimette da comprare. */
  const add = useCallback(async (names: string[]) => {
    setError("");
    const live = items.filter((i) => !i.deleted_at);
    const rows: Item[] = [];
    for (const name of names) {
      const existing = live.find((i) => normalize(i.name) === normalize(name));
      if (existing) {
        if (existing.checked) update(existing.id, { checked: false });
        continue;
      }
      if (rows.some((r) => normalize(r.name) === normalize(name))) continue;
      const category = guessCategory(name, stats);
      const last = Math.max(-1, ...[...live, ...rows].filter((i) => i.category === category).map((i) => i.position));
      rows.push({ id: crypto.randomUUID(), household_id: householdId, name, category, checked: false,
        position: positionBetween(last), updated_at: LOCAL, deleted_at: null });
    }
    if (!rows.length) return;
    setItems((prev) => [...prev, ...rows]);
    const { data, error } = await supabase.from("shopping_items")
      .insert(rows.map(({ id, household_id, name, category, position }) => ({ id, household_id, name, category, position })))
      .select(COLUMNS);
    if (error) return fail(error.message);
    setItems((prev) => data.reduce(mergeRow, prev));
    refetch(); // aggiorna i suggerimenti
  }, [householdId, items, stats, update, fail, refetch]);

  const clearChecked = useCallback(async () => {
    const ids = items.filter((i) => i.checked && !i.deleted_at).map((i) => i.id);
    if (!ids.length) return;
    const now = new Date().toISOString();
    setItems((prev) => prev.map((i) => (ids.includes(i.id) ? { ...i, deleted_at: now } : i)));
    const { error } = await supabase.from("shopping_items").update({ deleted_at: now }).in("id", ids);
    if (error) fail(error.message);
  }, [items, fail]);

  return {
    items, stats, error, loaded, add, clearChecked,
    setChecked: (id: string, checked: boolean) => update(id, { checked }),
    setCategory: (id: string, category: string) => update(id, { category }),
    /** Sposta fra due vicini dello stesso reparto (undefined = in cima / in fondo). */
    move: (id: string, before?: Item, after?: Item) => update(id, { position: positionBetween(before?.position, after?.position) }),
  };
}
