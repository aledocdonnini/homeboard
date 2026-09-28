"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Tables } from "@/lib/database.types";

export type Timer = Tables<"timers">;

/** Il Pi manda un battito ogni minuto: oltre questo, quello che si vede potrebbe non essere aggiornato. */
const STALE_MS = 3 * 60_000;

// I timer li tiene Roby sul Pi (funzionano anche senza rete); la PWA guarda la loro copia in Supabase.
// ponytail: si rilegge tutto a ogni cambio, i timer attivi sono pochi.
export function useTimers(householdId: string) {
  const [timers, setTimers] = useState<Timer[]>();
  /** null: nessun Pi abbinato (o mai visto). */
  const [piOnline, setPiOnline] = useState<boolean | null>(null);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    const [t, d] = await Promise.all([
      supabase.from("timers").select("*").eq("household_id", householdId).order("ends_at"),
      supabase.from("devices").select("last_seen_at").eq("household_id", householdId).order("last_seen_at", { ascending: false, nullsFirst: false }).limit(1),
    ]);
    if (t.error) return setError(t.error.message);
    setError("");
    setTimers(t.data);
    const seen = d.data?.[0]?.last_seen_at;
    setPiOnline(seen ? Date.now() - new Date(seen).getTime() < STALE_MS : null);
  }, [householdId]);

  useEffect(() => {
    const channel = supabase
      .channel(`timers:${householdId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "timers", filter: `household_id=eq.${householdId}` }, () => void reload())
      .subscribe((status) => status === "SUBSCRIBED" && reload());
    const every = setInterval(reload, 60_000);
    const onVisible = () => document.visibilityState === "visible" && reload();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(every);
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
    };
  }, [householdId, reload]);

  return { timers, error, piOnline };
}
