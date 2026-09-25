import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// Un solo client, nel browser: la PWA legge e scrive dal client (serve anche offline),
// la sicurezza sta nelle policy RLS. La sessione resta in localStorage.
export const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
);
