"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House } from "@phosphor-icons/react";
import RobyTile from "@/components/ui/RobyTile";

// I tasti di preselezione del televisore. Il numero è il canale della TV che mostra la stessa cosa.
// Telefono: una fila di tasti in basso, sotto il pollice; premuto = nero, come un tasto abbassato.
// Desktop: una colonna di numeri a destra, come il resto del cruscotto (niente riquadri, linee fra le voci);
// il canale attivo ha il numero arancio, come l'OSD della TV. Casa in fondo, Roby in cima.
// La colonna sta dentro la zona sicura (--overscan), come tutto il contenuto: la cornice non la copre.
const TABS = [
  { href: "/", label: "Oggi", key: "1" },
  { href: "/spesa", label: "Spesa", key: "2" },
  { href: "/promemoria", label: "Promemoria", key: "3" },
  { href: "/scadenze", label: "Scadenze", key: "4" },
  { href: "/casa", label: "Casa", key: null },
];

export default function TabBar() {
  const path = usePathname();
  if (!TABS.some((t) => t.href === path)) return null;
  return (
    <nav aria-label="Sezioni" data-rail
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper pb-[env(safe-area-inset-bottom)]
        lg:inset-y-[var(--overscan)] lg:right-[var(--overscan)] lg:left-auto lg:w-28 lg:border-t-0 lg:border-l lg:bg-transparent lg:pb-0">
      <RobyTile expression="happy" className="mt-8 mb-2 ml-4 hidden size-12 lg:block" />
      <ul className="mx-auto grid max-w-lg grid-cols-5 gap-1.5 px-2 py-2
        lg:flex lg:h-[calc(100%-6rem)] lg:max-w-none lg:flex-col lg:gap-0 lg:px-4 lg:py-4">
        {TABS.map((t) => (
          <li key={t.href} className={t.key ? "" : "lg:mt-auto"}>
            <Link
              href={t.href}
              aria-current={path === t.href ? "page" : undefined}
              className="group flex min-h-14 flex-col items-center justify-center rounded-control border border-b-4 border-edge bg-surface
                active:translate-y-px aria-[current=page]:border-ink aria-[current=page]:bg-ink aria-[current=page]:text-paper
                lg:min-h-0 lg:items-start lg:gap-1 lg:rounded-none lg:border-0 lg:border-t lg:border-line lg:bg-transparent lg:py-4
                lg:text-muted lg:hover:text-ink lg:aria-[current=page]:bg-transparent lg:aria-[current=page]:text-ink"
            >
              {t.key
                ? <span aria-hidden className="[font-stretch:75%] text-2xl leading-none font-semibold lg:text-6xl lg:leading-[0.8] lg:group-aria-[current=page]:text-accent-text">{t.key}</span>
                : <House aria-hidden weight="bold" className="size-5 lg:size-8 lg:group-aria-[current=page]:text-accent-text" />}
              <span className="text-[0.7rem] font-semibold lg:text-sm">{t.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
