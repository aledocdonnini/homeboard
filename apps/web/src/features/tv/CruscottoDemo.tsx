"use client";

import Cruscotto from "./Cruscotto";
import { sample } from "./sample";

// /cruscotto: la vista TV con dati d'esempio, per provarla senza casa né Raspberry.
export default function CruscottoDemo() {
  return <Cruscotto data={sample} tv />;
}
