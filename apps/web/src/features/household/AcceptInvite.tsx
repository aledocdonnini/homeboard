"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/features/auth/useSession";

export default function AcceptInvite() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const session = useSession();
  const [error, setError] = useState("");
  const done = useRef(false); // l'invito si consuma: una chiamata sola anche se l'effetto riparte

  useEffect(() => {
    if (session === null) router.replace(`/accedi?next=${encodeURIComponent(`/invito/${token}`)}`);
    if (!session || done.current) return;
    done.current = true;
    supabase.rpc("accept_invite", { invite: token }).then(({ error }) => {
      if (error) setError(error.code === "P0002" ? "Questo invito non è valido o è scaduto. Chiedine uno nuovo." : error.message);
      else router.replace("/");
    });
  }, [session, token, router]);

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 p-6">
      <h1 className="text-3xl font-semibold">Invito</h1>
      {error ? <p role="alert">{error}</p> : <p aria-live="polite">Ti sto aggiungendo alla casa…</p>}
    </main>
  );
}
