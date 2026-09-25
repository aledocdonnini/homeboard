import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// Un solo client, nel browser: la PWA legge e scrive dal client (serve anche offline),
// la sicurezza sta nelle policy RLS. La sessione resta in localStorage.
// Con la rete a singhiozzo una richiesta può restare appesa per minuti: dopo 8 s diventa un errore di rete,
// e la sincronizzazione riprova più tardi. (Il realtime è un websocket e non passa di qui.)
const TIMEOUT_MS = 8000;
const fetchWithTimeout: typeof fetch = (input, init) => {
  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  return fetch(input, { ...init, signal: init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout });
};

const make = (storageKey?: string) => createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  { global: { fetch: fetchWithTimeout }, auth: storageKey ? { storageKey } : undefined },
);

export const supabase = make();

// La TV ha una sessione sua (utente anonimo abbinato alla casa), salvata a parte: nello stesso browser
// si può essere membri nella PWA e provare /tv senza che le due sessioni si pestino.
let tv: ReturnType<typeof make> | undefined;
export const tvClient = () => (tv ??= make("hb-tv-auth"));
