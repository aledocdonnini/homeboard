"use client";

import type { ReactNode } from "react";
import { SerwistProvider } from "@serwist/turbopack/react";

// Registra il service worker. Spento in sviluppo (cache vecchie e confuse); niente ricarica al ritorno della rete:
// ci pensa la sincronizzazione, e una ricarica butterebbe via quello che stai scrivendo.
export default function ServiceWorker({ children }: { children: ReactNode }) {
  return (
    <SerwistProvider swUrl="/serwist/sw.js" disable={process.env.NODE_ENV === "development"} reloadOnOnline={false}>
      {children}
    </SerwistProvider>
  );
}
