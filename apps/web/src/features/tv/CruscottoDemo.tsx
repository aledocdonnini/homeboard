"use client";

import { sample } from "./sample";
import TvScreen from "./TvScreen";

// /cruscotto: la TV con dati d'esempio, per provarla senza casa né Raspberry (tasti 1-6).
export default function CruscottoDemo() {
  return <TvScreen data={sample} tz="Europe/Rome" />;
}
