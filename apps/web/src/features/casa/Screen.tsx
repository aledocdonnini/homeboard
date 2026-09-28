"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import type { View } from "@/features/assistant/useAssistant";
import HouseholdGate, { type Household } from "@/features/household/HouseholdGate";
import DesktopStation from "./DesktopStation";

const WIDE = "(min-width: 1024px)";
const subscribe = (cb: () => void) => {
  const mq = matchMedia(WIDE);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
/** Schermo grande (computer): la PWA diventa la postazione. Sul server si parte dal telefono. */
const useWide = () => useSyncExternalStore(subscribe, () => matchMedia(WIDE).matches, () => false);

/**
 * Una sezione della PWA. Sul telefono la sua pagina, con la barra in basso; sul computer la postazione, uguale alla
 * TV, con questa sezione al centro (e da lì si cambia a comando: "mostrami i promemoria").
 */
export default function Screen({ view, phone }: { view: View; phone: (house: Household) => ReactNode }) {
  const wide = useWide();
  return <HouseholdGate>{(house) => (wide ? <DesktopStation house={house} view={view} /> : phone(house))}</HouseholdGate>;
}
