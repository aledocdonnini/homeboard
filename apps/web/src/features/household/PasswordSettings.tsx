"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import Button from "@/components/ui/Button";
import Field from "@/components/ui/Field";

const MIN = 8;

// La password serve per entrare dalla PWA installata: il link della mail si apre nel browser, che ha una sessione
// sua. Si imposta qui (anche arrivando da "password dimenticata", che apre /impostazioni?password=1).
export default function PasswordSettings() {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const section = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!new URLSearchParams(location.search).has("password")) return;
    section.current?.scrollIntoView({ block: "center" });
    section.current?.querySelector("input")?.focus();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return; // un secondo invio (doppio clic, password manager) non deve partire
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setResult({ ok: false, text: error.code === "same_password" ? "È già la tua password." : error.code === "weak_password" ? `Troppo corta: almeno ${MIN} caratteri.` : `Non salvata: ${error.message}` });
      return;
    }
    setPassword("");
    setResult({ ok: true, text: "Password salvata. Dalla app installata ora entri con email e password." });
  }

  return (
    <section ref={section} id="password" aria-labelledby="password-title" className="flex flex-col gap-3 lg:border-t-4 lg:border-ink lg:pt-5">
      <h2 id="password-title" className="text-xl font-semibold">Password</h2>
      <p className="text-muted">Serve per entrare dalla app installata sul telefono. Se l&apos;avevi già, questa la sostituisce.</p>
      <form onSubmit={save} className="flex flex-col gap-3">
        <Field id="new-password" label="Nuova password" type="password" autoComplete="new-password" required minLength={MIN}
          value={password} onChange={(e) => { setPassword(e.target.value); setResult(null); }}
          hint={result?.ok ? result.text : `Almeno ${MIN} caratteri.`} error={result && !result.ok ? result.text : undefined} />
        <Button type="submit" disabled={busy || password.length < MIN} className="self-start">{busy ? "Salvataggio" : "Salva la password"}</Button>
      </form>
    </section>
  );
}
