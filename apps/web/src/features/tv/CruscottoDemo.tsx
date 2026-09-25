"use client";

import { sample } from "./sample";
import TvScreen from "./TvScreen";

// /cruscotto: la TV con dati d'esempio, per provarla senza casa né Raspberry (tasti 1-6).
// Come /tv accetta ?voce=… (per esempio il server Piper) e ?overscan=….
export default function CruscottoDemo() {
  const voiceUrl = new URLSearchParams(location.search).get("voce");
  return <TvScreen data={sample} tz="Europe/Rome" voiceUrl={voiceUrl} />;
}
