/// <reference lib="esnext" />
/// <reference lib="webworker" />
// Service worker (Serwist): precarica l'app, così si apre anche senza rete. I dati offline stanno in IndexedDB
// (lib/localdb.ts), non qui. Escluso da tsconfig: lo compila esbuild con i tipi del worker.
import { defaultCache } from "@serwist/turbopack/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();

// ——— Notifiche push (inviate dalla Edge Function `notify`) ———
type PushPayload = { title: string; body: string; url?: string; tag?: string };

self.addEventListener("push", (event) => {
  const data = (event.data?.json() ?? { title: "Homeboard", body: "" }) as PushPayload;
  event.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    icon: "/icons/192",
    tag: data.tag, // stessa cosa, stessa notifica: la nuova sostituisce la vecchia
    data: { url: data.url ?? "/" },
  }));
});

// Toccando la notifica si apre (o si porta in primo piano) l'app sulla sezione giusta.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data as { url?: string })?.url ?? "/", self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
    if (open) {
      await open.focus();
      await open.navigate(url);
    } else {
      await self.clients.openWindow(url);
    }
  })());
});
