"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Button from "@/components/ui/Button";
import Field from "@/components/ui/Field";
import RobyTile from "@/components/ui/RobyTile";
import { useSession } from "./useSession";

// Pagina di arrivo dopo l'accesso: solo percorsi interni.
const nextPath = () => {
  const next = new URLSearchParams(location.search).get("next");
  return next?.startsWith("/") && !next.startsWith("//") ? next : "/";
};

export default function LoginForm() {
  const router = useRouter();
  const session = useSession();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Arrivati dal link della mail, o già dentro: si prosegue.
  useEffect(() => {
    if (session) router.replace(nextPath());
  }, [session, router]);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/accedi?next=${encodeURIComponent(nextPath())}` },
    });
    setBusy(false);
    if (error) setError(`Email non inviata: ${error.message}`);
    else setSent(true);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
    setBusy(false);
    if (error) setError("Codice non valido o scaduto. Controlla l'ultima email o chiedine uno nuovo.");
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 px-4 py-10">
      <div className="flex flex-col gap-4">
        <RobyTile expression={sent ? "listening" : "happy"} />
        <h1 className="text-4xl font-bold tracking-tight">Accedi a Homeboard</h1>
        <p className="text-muted">
          {sent ? <>Ti ho scritto a <strong className="text-ink">{email}</strong>. Scrivi qui il codice, oppure apri il link nella mail.</>
            : "Ti mando un codice via email. Niente password da ricordare."}
        </p>
      </div>
      {!sent ? (
        <form onSubmit={sendCode} className="flex flex-col gap-4">
          <Field id="email" label="Email" type="email" required autoComplete="email" inputMode="email"
            value={email} onChange={(e) => setEmail(e.target.value)} error={error} />
          <Button type="submit" disabled={busy}>{busy ? "Invio in corso" : "Mandami il codice"}</Button>
        </form>
      ) : (
        <form onSubmit={verify} className="flex flex-col gap-4">
          <Field id="code" label="Codice di 6 cifre" required autoComplete="one-time-code" inputMode="numeric"
            pattern="[0-9]{6}" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            error={error} className="text-center [font-stretch:75%] font-semibold text-4xl tracking-[0.3em]" />
          <Button type="submit" disabled={busy}>{busy ? "Verifica in corso" : "Entra"}</Button>
          <Button variant="link" onClick={() => { setSent(false); setError(""); }} className="self-start">Usa un’altra email</Button>
        </form>
      )}
    </main>
  );
}
