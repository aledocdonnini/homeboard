"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function CreateHousehold({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("Casa");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.rpc("create_household", { name });
    setBusy(false);
    if (error) setError(error.message);
    else onCreated();
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-6">
      <h1 className="text-3xl font-semibold">La tua casa</h1>
      <p>Crea una casa e invita chi ci abita. Se qualcuno ti ha già invitato, apri il link che ti ha mandato.</p>
      <form onSubmit={create} className="flex flex-col gap-3">
        <label htmlFor="name">Nome della casa</label>
        <input
          id="name" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)}
          className="rounded-lg border bg-transparent p-3 text-lg"
        />
        <button disabled={busy} className="rounded-full bg-foreground p-3 text-background disabled:opacity-50">Crea</button>
      </form>
      <p role="alert" className="text-red-600 dark:text-red-400">{error}</p>
    </main>
  );
}
