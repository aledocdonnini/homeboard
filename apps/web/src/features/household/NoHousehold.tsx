"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Button from "@/components/ui/Button";
import RobyTile from "@/components/ui/RobyTile";
import CreateHousehold from "./CreateHousehold";

// Nessuna casa: chi è autorizzato la crea, gli altri aspettano che il proprietario li aggiunga.
export default function NoHousehold({ email, onCreated }: { email: string; onCreated: () => void }) {
  const [canCreate, setCanCreate] = useState<boolean>();
  useEffect(() => {
    supabase.rpc("can_create_household").then(({ data }) => setCanCreate(!!data));
  }, []);

  if (canCreate === undefined) return null;
  if (canCreate) return <CreateHousehold onCreated={onCreated} />;
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-10">
      <RobyTile expression="sleepy" />
      <h1 className="text-4xl font-bold tracking-tight">Non sei ancora in una casa</h1>
      <p className="text-muted">
        Chi gestisce la casa ti aggiunge con la tua email, <strong className="text-ink">{email}</strong>. Appena l&apos;ha fatto, ricarica.
      </p>
      <Button variant="quiet" onClick={onCreated} className="self-start">Ricarica</Button>
    </main>
  );
}
