"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
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
    if (error) setError(error.message);
    else setSent(true);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
    setBusy(false);
    if (error) setError("Codice non valido o scaduto.");
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-6">
      <h1 className="text-3xl font-semibold">Accedi</h1>
      {!sent ? (
        <form onSubmit={sendCode} className="flex flex-col gap-3">
          <label htmlFor="email">La tua email</label>
          <input
            id="email" type="email" required autoComplete="email" inputMode="email"
            value={email} onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border bg-transparent p-3 text-lg"
          />
          <button disabled={busy} className="rounded-full bg-foreground p-3 text-background disabled:opacity-50">
            {busy ? "Invio…" : "Mandami il codice"}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="flex flex-col gap-3">
          <p>Ti ho scritto a <strong>{email}</strong>. Inserisci il codice, oppure apri il link nella mail.</p>
          <label htmlFor="code">Codice</label>
          <input
            id="code" required autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
            value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="rounded-lg border bg-transparent p-3 text-center font-mono text-2xl tracking-[0.4em]"
          />
          <button disabled={busy} className="rounded-full bg-foreground p-3 text-background disabled:opacity-50">
            {busy ? "Verifica…" : "Entra"}
          </button>
          <button type="button" onClick={() => setSent(false)} className="p-2 underline">Cambia email</button>
        </form>
      )}
      <p role="alert" className="text-red-600 dark:text-red-400">{error}</p>
    </main>
  );
}
