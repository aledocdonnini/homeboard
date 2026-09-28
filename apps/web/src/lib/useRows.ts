"use client";

import { useCallback, useEffect, useState } from "react";
import { isNewer } from "@homeboard/core/sync";
import { supabase } from "./supabase";

type Row = { id: string; updated_at: string; deleted_at: string | null };
type Table = "reminders" | "deadlines" | "notes";

// Righe di una tabella della casa: lettura, realtime e una copia sul dispositivo per consultarle offline.
// ponytail: le modifiche qui sono solo online (la coda offline serve alla spesa); se servirà, stessa strada di engine.ts.
export function useRows<T extends Row>(table: Table, householdId: string, columns = "*") {
  const key = `hb:${table}:${householdId}`;
  const [rows, setRows] = useState<T[]>();
  const [error, setError] = useState("");

  const merge = useCallback((incoming: T[]) => setRows((prev) => {
    const map = new Map((prev ?? []).map((r) => [r.id, r]));
    for (const r of incoming) if (!isNewer(map.get(r.id), r)) map.set(r.id, r);
    const next = [...map.values()].filter((r) => !r.deleted_at);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
    return next;
  }), [key]);

  const reload = useCallback(async () => {
    const { data, error } = await supabase.from(table).select(columns).eq("household_id", householdId).is("deleted_at", null);
    if (error) return setError(error.message);
    setError("");
    setRows(() => {
      try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
      return data as unknown as T[];
    });
  }, [table, columns, householdId, key]);

  useEffect(() => {
    // Prima la copia salvata (si apre subito, anche offline), poi il server.
    Promise.resolve().then(() => {
      try {
        const cached = JSON.parse(localStorage.getItem(key) ?? "null");
        if (cached) setRows((prev) => prev ?? cached);
      } catch {}
    });
    const channel = supabase
      .channel(`${table}:${householdId}`)
      .on("postgres_changes", { event: "*", schema: "public", table, filter: `household_id=eq.${householdId}` },
        (payload) => payload.new && "id" in payload.new && merge([payload.new as T]))
      .subscribe((status) => status === "SUBSCRIBED" && reload());
    const onVisible = () => document.visibilityState === "visible" && reload();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
    };
  }, [table, householdId, key, merge, reload]);

  return { rows, error, setError, reload, merge };
}
