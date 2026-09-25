import { clearLocal } from "@/lib/localdb";
import { supabase } from "@/lib/supabase";

/** Esce e cancella dal dispositivo i dati della casa (copia locale, coda, casa salvata). */
export async function signOut() {
  // ponytail: le modifiche ancora in coda si perdono; avvisare prima se diventerà un problema.
  // Questo dispositivo smette di ricevere le notifiche di questo account.
  try {
    const sub = await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription();
    if (sub) {
      await supabase.rpc("delete_push_subscription", { endpoint: sub.endpoint });
      await sub.unsubscribe();
    }
  } catch {}
  await clearLocal();
  try {
    Object.keys(localStorage).filter((k) => k.startsWith("hb:")).forEach((k) => localStorage.removeItem(k));
  } catch {}
  await supabase.auth.signOut();
}
