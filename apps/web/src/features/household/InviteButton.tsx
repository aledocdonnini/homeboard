"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

// Crea un link d'invito (uso singolo, 7 giorni) e lo passa al foglio di condivisione, o agli appunti.
export default function InviteButton({ householdId, householdName }: { householdId: string; householdName: string }) {
  const [link, setLink] = useState("");
  const [status, setStatus] = useState("");

  async function invite() {
    setStatus("");
    const { data, error } = await supabase.from("household_invites").insert({ household_id: householdId }).select("token").single();
    if (error) return setStatus(error.message);
    const url = `${location.origin}/invito/${data.token}`;
    setLink(url);
    if (navigator.share) {
      await navigator.share({ title: "Homeboard", text: `Entra in ${householdName} su Homeboard`, url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url);
      setStatus("Link copiato.");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button type="button" onClick={invite} className="self-start rounded-full border px-4 py-2">Invita qualcuno</button>
      {link && (
        <p className="text-sm">
          Vale una volta sola, per 7 giorni: <span className="break-all font-mono">{link}</span>
        </p>
      )}
      <p aria-live="polite" className="text-sm">{status}</p>
    </div>
  );
}
