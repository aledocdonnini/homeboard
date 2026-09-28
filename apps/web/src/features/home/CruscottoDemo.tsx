"use client";

import Cruscotto from "./Cruscotto";
import { sample } from "./sample";

// /cruscotto: la home della PWA con dati d'esempio, per vederla senza casa né login.
export default function CruscottoDemo() {
  return <Cruscotto data={sample} />;
}
