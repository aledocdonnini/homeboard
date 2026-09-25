"use client";

import { useEffect, useState } from "react";
import { BellRinging, BellSlash } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import Button from "@/components/ui/Button";

type State = "loading" | "unsupported" | "ios-install" | "denied" | "off" | "on";

// La chiave VAPID pubblica, dal formato base64url all'array che vuole pushManager.subscribe.
const key = (b64: string) => {
  const s = atob((b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};

async function currentState(): Promise<State> {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const standalone = matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
  // Su iPhone le push web ci sono solo con l'app aggiunta alla schermata Home (iOS 16.4 o successivo).
  if (ios && !standalone) return "ios-install";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription()) ? "on" : "off";
}

// Notifiche su questo dispositivo: attiva, disattiva, prova.
export default function PushSettings() {
  const [state, setState] = useState<State>("loading");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { currentState().then(setState); }, []);

  async function enable() {
    setBusy(true);
    setMessage("");
    try {
      if ((await Notification.requestPermission()) !== "granted") return setState(await currentState());
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!) });
      const { endpoint, keys } = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      const { error } = await supabase.rpc("save_push_subscription", { endpoint, p256dh: keys.p256dh, auth: keys.auth, user_agent: navigator.userAgent });
      if (error) throw error;
      setState("on");
    } catch (e) {
      setMessage(`Notifiche non attivate: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
    if (sub) {
      await supabase.rpc("delete_push_subscription", { endpoint: sub.endpoint });
      await sub.unsubscribe();
    }
    setBusy(false);
    setState("off");
  }

  async function test() {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke<{ sent: number }>("notify", { body: {} });
    setBusy(false);
    setMessage(error ? `Prova non inviata: ${error.message}` : data?.sent ? "Prova inviata: dovrebbe arrivare tra qualche secondo." : "Nessun dispositivo iscritto.");
  }

  return (
    <section aria-labelledby="push" className="flex flex-col gap-3 border-t-4 border-ink pt-5">
      <h2 id="push" className="text-xl font-semibold">Notifiche su questo dispositivo</h2>
      {state === "on" && <p className="text-muted">Attive: ti avviso per promemoria e scadenze.</p>}
      {state === "off" && <p className="text-muted">Spente. Attivale per ricevere promemoria e scadenze anche con l&apos;app chiusa.</p>}
      {state === "denied" && <p className="text-muted">Le hai bloccate per questo sito. Riattivale dalle impostazioni del browser, poi torna qui.</p>}
      {state === "unsupported" && <p className="text-muted">Questo browser non supporta le notifiche push.</p>}
      {state === "ios-install" && (
        <p className="text-muted">
          Su iPhone le notifiche arrivano solo con l&apos;app sulla schermata Home: tocca Condividi, poi &laquo;Aggiungi alla schermata Home&raquo;, e apri Homeboard da lì.
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        {state === "off" && <Button onClick={enable} disabled={busy}><BellRinging aria-hidden weight="bold" className="size-5" /> Attiva le notifiche</Button>}
        {state === "on" && (
          <>
            <Button onClick={test} disabled={busy}>Invia una prova</Button>
            <Button variant="quiet" onClick={disable} disabled={busy}><BellSlash aria-hidden weight="bold" className="size-5" /> Disattiva</Button>
          </>
        )}
      </div>
      <p aria-live="polite" className="text-sm empty:hidden">{message}</p>
    </section>
  );
}
