"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Button from "@/components/ui/Button";
import Field from "@/components/ui/Field";
import PageHeader from "@/components/ui/PageHeader";
import type { Household } from "./HouseholdGate";

// Abbina una TV: il codice che mostra lo schermo (arriva già compilato dal QR).
export default function PairTv({ house }: { house: Household }) {
  const router = useRouter();
  const [code, setCode] = useState(() => new URLSearchParams(location.search).get("codice")?.toUpperCase() ?? "");
  const [name, setName] = useState("TV Crezar");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function pair(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.rpc("claim_pairing", { code, household: house.id, name: name.trim() || "TV" });
    setBusy(false);
    if (error) setError(error.code === "P0002" ? "Codice non valido o scaduto: controlla quello sullo schermo, se serve ne compare uno nuovo." : error.message);
    else router.replace("/impostazioni");
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 pt-6 pb-32">
      <PageHeader title="Abbina una TV">
        <p className="text-xl text-muted">Roby, sulla TV, vedrà spesa, promemoria e scadenze di {house.name} e potrà aggiornarli a voce. Membri e impostazioni della casa restano solo tuoi.</p>
      </PageHeader>
      <form onSubmit={pair} className="flex flex-col gap-4">
        <Field id="code" label="Codice sullo schermo" required autoComplete="off" autoCapitalize="characters" maxLength={6}
          value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
          className="text-center text-4xl font-semibold tracking-[0.3em]" error={error} />
        <Field id="tv-name" label="Nome" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
        <Button type="submit" disabled={busy || code.length !== 6}>Abbina</Button>
      </form>
    </main>
  );
}
