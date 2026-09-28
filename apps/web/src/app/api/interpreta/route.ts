// Il ripiego della PWA per le frasi che le regole non capiscono: un modello linguistico, lato server, perché la
// chiave del provider non deve arrivare al telefono. Spento se ROBY_LLM non è impostato (risponde 501).
// Solo per chi ha una sessione Supabase valida (header Authorization), così nessun altro consuma la quota.
// Al modello va solo la frase (con ora e nomi di timer e scadenze), mai le note.

import { createClient } from "@supabase/supabase-js";
import { interpret, llmFallback, llmFromEnv } from "@homeboard/intents";

const strings = (x: unknown, max: number) =>
  Array.isArray(x) ? x.filter((s): s is string => typeof s === "string").slice(0, max).map((s) => s.slice(0, 120)) : [];

export async function POST(request: Request) {
  let llm;
  try {
    llm = llmFromEnv(process.env);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
  if (!llm) return Response.json({ error: "Modello linguistico non configurato" }, { status: 501 });

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
  const { data, error } = token ? await supabase.auth.getUser(token) : { data: null, error: true };
  if (error || !data?.user || data.user.is_anonymous) return Response.json({ error: "Accesso richiesto" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const text = typeof body.text === "string" ? body.text.trim().slice(0, 500) : "";
  const timezone = typeof body.timezone === "string" ? body.timezone : "Europe/Rome";
  if (!text) return Response.json({ error: "Frase vuota" }, { status: 400 });
  try {
    new Intl.DateTimeFormat("it-IT", { timeZone: timezone });
  } catch {
    return Response.json({ error: "Fuso orario non valido" }, { status: 400 });
  }

  const result = await interpret(text, {
    now: new Date(), timezone, timers: strings(body.timers, 20), deadlines: strings(body.deadlines, 50),
  }, llmFallback(llm));
  return Response.json(result);
}
