import { createSerwistRoute } from "@serwist/turbopack";

// Versione delle pagine precaricate: nuova a ogni build. Non il commit: due build dello stesso commit
// (modifiche non committate, o una nuova build dello stesso deploy) terrebbero l'HTML vecchio, che punta a script vecchi.
const revision = crypto.randomUUID();

// Le pagine dell'app, precaricate: si aprono anche offline, pure al primo avvio senza rete.
const PAGES = ["/", "/spesa", "/promemoria", "/scadenze", "/timer", "/note", "/impostazioni", "/accedi", "/abbina", "/casa"];

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute({
  additionalPrecacheEntries: PAGES.map((url) => ({ url, revision })),
  swSrc: "src/app/sw.ts",
  useNativeEsbuild: true,
});
