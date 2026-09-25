"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import Button from "@/components/ui/Button";
import Field from "@/components/ui/Field";
import RobyTile from "@/components/ui/RobyTile";

export default function CreateHousehold({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("Casa");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.rpc("create_household", { name });
    setBusy(false);
    if (error) setError(`Casa non creata: ${error.message}`);
    else onCreated();
  }

  return (
    <main data-channel="casa" className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 px-4 py-10">
      <div className="flex flex-col gap-4">
        <RobyTile expression="excited" />
        <h1 className="text-4xl font-bold tracking-tight">Crea la tua casa</h1>
        <p className="text-muted">Poi invita chi ci abita. Se qualcuno ti ha già invitato, apri il link che ti ha mandato.</p>
      </div>
      <form onSubmit={create} className="flex flex-col gap-4">
        <Field id="name" label="Nome della casa" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} error={error} />
        <Button type="submit" disabled={busy}>Crea la casa</Button>
      </form>
    </main>
  );
}
