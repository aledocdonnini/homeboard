"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

/** undefined = ancora in caricamento, null = nessun membro connesso. Le sessioni anonime (TV) non contano. */
export function useSession() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s && !s.user.is_anonymous ? s : null));
    return () => data.subscription.unsubscribe();
  }, []);
  return session;
}
