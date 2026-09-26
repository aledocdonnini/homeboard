"use client";

import { useState } from "react";
import { UserPlus } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import Button from "@/components/ui/Button";
import Field from "@/components/ui/Field";

// Solo il proprietario: aggiunge una persona alla casa con la sua email.
// Se ha già un account entra subito; altrimenti entra da sola al primo accesso con quell'email.
export default function AddMember({ householdId, onAdded }: { householdId: string; onAdded: () => void }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { data, error } = await supabase.rpc("add_member", { household: householdId, email });
    setBusy(false);
    if (error) return setError(error.code === "22023" ? "Controlla l'email: non sembra valida." : error.message);
    setStatus(data === "aggiunta"
      ? `${email} è in casa.`
      : `Fatto. ${email} entrerà in casa al primo accesso: apre l'app, scrive questa email e riceve il codice.`);
    setEmail("");
    // Già con un account: è in casa, si aggiorna l'elenco (dopo aver letto il messaggio). In attesa: l'elenco non cambia.
    if (data === "aggiunta") setTimeout(onAdded, 1500);
  }

  return (
    <form onSubmit={add} className="flex flex-col gap-3 pt-2">
      <Field id="member-email" label="Aggiungi una persona" type="email" required autoComplete="off" inputMode="email"
        placeholder="nome@esempio.it" value={email} onChange={(e) => setEmail(e.target.value)} error={error} />
      <Button type="submit" variant="quiet" disabled={busy} className="self-start">
        <UserPlus aria-hidden weight="bold" className="size-5" /> Aggiungi
      </Button>
      <p aria-live="polite" className="text-sm empty:hidden">{status}</p>
    </form>
  );
}
