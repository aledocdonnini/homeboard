import { clearLocal } from "@/lib/localdb";
import { supabase } from "@/lib/supabase";

/** Esce e cancella dal dispositivo i dati della casa (copia locale, coda, casa salvata). */
export async function signOut() {
  // ponytail: le modifiche ancora in coda si perdono; avvisare prima se diventerà un problema.
  await clearLocal();
  try {
    Object.keys(localStorage).filter((k) => k.startsWith("hb:")).forEach((k) => localStorage.removeItem(k));
  } catch {}
  await supabase.auth.signOut();
}
