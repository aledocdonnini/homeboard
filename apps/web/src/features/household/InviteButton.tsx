"use client";

import { useState } from "react";
import { UserPlus } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import Button from "@/components/ui/Button";

// Crea un link d'invito (uso singolo, 7 giorni) e lo passa al foglio di condivisione, o agli appunti.
export default function InviteButton({ householdId, householdName }: { householdId: string; householdName: string }) {
  const [link, setLink] = useState("");
  const [status, setStatus] = useState("");

  async function invite() {
    setStatus("");
    const { data, error } = await supabase.from("household_invites").insert({ household_id: householdId }).select("token").single();
    if (error) return setStatus(`Invito non creato: ${error.message}`);
    const url = `${location.origin}/invito/${data.token}`;
    setLink(url);
    if (navigator.share) {
      await navigator.share({ title: "Homeboard", text: `Entra in ${householdName} su Homeboard`, url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url);
      setStatus("Link copiato negli appunti.");
    }
  }

  return (
    <div className="flex flex-col gap-3 pt-2">
      <Button variant="quiet" onClick={invite} className="self-start">
        <UserPlus aria-hidden weight="bold" className="size-5" /> Invita qualcuno
      </Button>
      {link && (
        <p className="text-sm text-muted">
          Il link vale una volta sola, per 7 giorni: <span className="break-all text-ink">{link}</span>
        </p>
      )}
      <p aria-live="polite" className="text-sm empty:hidden">{status}</p>
    </div>
  );
}
