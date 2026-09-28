"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DotsThree, GearSix } from "@phosphor-icons/react";
import RobyTile from "@/components/ui/RobyTile";

// I tasti di preselezione, come quelli del televisore.
// Telefono: una fila di tasti in basso, sotto il pollice; premuto = nero, come un tasto abbassato. Ci stanno le
// quattro sezioni di tutti i giorni; Timer, Note e Impostazioni sono sotto "Altro" (popover nativo).
// Desktop: una colonna di numeri a destra, come il resto del cruscotto (niente riquadri, linee fra le voci);
// la sezione attiva ha il numero arancio. Impostazioni in fondo, Roby in cima.
// La colonna sta dentro la zona sicura (--overscan), come tutto il contenuto: la cornice non la copre.
const TABS = [
  { href: "/", label: "Oggi", key: "1", more: false },
  { href: "/spesa", label: "Spesa", key: "2", more: false },
  { href: "/promemoria", label: "Promemoria", key: "3", more: false },
  { href: "/scadenze", label: "Scadenze", key: "4", more: false },
  { href: "/timer", label: "Timer", key: "5", more: true },
  { href: "/note", label: "Note", key: "6", more: true },
  { href: "/impostazioni", label: "Impostazioni", key: null, more: true },
];

const KEY = `group flex min-h-14 w-full flex-col items-center justify-center rounded-control border border-b-4 border-edge bg-surface
  active:translate-y-px aria-[current=page]:border-ink aria-[current=page]:bg-ink aria-[current=page]:text-paper
  lg:min-h-0 lg:items-start lg:gap-1 lg:rounded-none lg:border-0 lg:border-t lg:border-line lg:bg-transparent lg:py-4
  lg:text-muted lg:hover:text-ink lg:aria-[current=page]:bg-transparent lg:aria-[current=page]:text-ink`;

export default function TabBar() {
  const path = usePathname();
  if (!TABS.some((t) => t.href === path)) return null;
  const inMore = TABS.some((t) => t.more && t.href === path);
  return (
    <nav aria-label="Sezioni" data-rail
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper pb-[env(safe-area-inset-bottom)]
        lg:inset-y-[var(--overscan)] lg:right-[var(--overscan)] lg:left-auto lg:w-28 lg:border-t-0 lg:border-l lg:bg-transparent lg:pb-0">
      <RobyTile expression="happy" className="mt-8 mb-2 ml-4 hidden size-12 lg:block" />
      <ul className="mx-auto grid max-w-lg grid-cols-5 gap-1.5 px-2 py-2
        lg:flex lg:h-[calc(100%-6rem)] lg:max-w-none lg:flex-col lg:gap-0 lg:px-4 lg:py-4">
        {TABS.map((t) => (
          <li key={t.href} className={`${t.more ? "hidden lg:block" : ""} ${t.key ? "" : "lg:mt-auto"}`}>
            <Tab tab={t} current={path === t.href} />
          </li>
        ))}
        <li className="lg:hidden">
          <button type="button" popoverTarget="altro" aria-current={inMore ? "page" : undefined} className={KEY}>
            <DotsThree aria-hidden weight="bold" className="size-6" />
            <span className="text-[0.7rem] font-semibold">Altro</span>
          </button>
        </li>
      </ul>
      <div id="altro" popover="auto"
        className="fixed inset-auto right-2 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] m-0 w-48 rounded-module border border-edge bg-paper p-2 text-ink lg:hidden">
        <ul className="flex flex-col gap-1.5">
          {TABS.filter((t) => t.more).map((t) => (
            <li key={t.href}>
              <Link href={t.href} aria-current={path === t.href ? "page" : undefined}
                onClick={() => document.getElementById("altro")?.hidePopover()}
                className="flex min-h-12 items-center gap-3 rounded-control px-3 text-lg font-semibold aria-[current=page]:bg-ink aria-[current=page]:text-paper">
                {t.key ? <span aria-hidden className="w-5 [font-stretch:75%] text-2xl">{t.key}</span> : <GearSix aria-hidden weight="bold" className="size-5" />}
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

function Tab({ tab: t, current }: { tab: (typeof TABS)[number]; current: boolean }) {
  return (
    <Link href={t.href} aria-current={current ? "page" : undefined} className={KEY}>
      {t.key
        ? <span aria-hidden className="[font-stretch:75%] text-2xl leading-none font-semibold lg:text-6xl lg:leading-[0.8] lg:group-aria-[current=page]:text-accent-text">{t.key}</span>
        : <GearSix aria-hidden weight="bold" className="size-5 lg:size-8 lg:group-aria-[current=page]:text-accent-text" />}
      <span className="text-[0.7rem] font-semibold lg:text-sm">{t.label}</span>
    </Link>
  );
}
