"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DotsThree, GearSix } from "@phosphor-icons/react";

// I tasti di preselezione, come quelli del televisore. Solo sul telefono: sul computer la PWA è la postazione,
// uguale alla TV, e la vista si cambia a comando ("mostrami i promemoria"), senza tasti.
// Una fila di tasti in basso, sotto il pollice; premuto = nero, come un tasto abbassato. Ci stanno le quattro
// sezioni di tutti i giorni; Timer, Note e Impostazioni sono sotto "Altro" (popover nativo).
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
  active:translate-y-px aria-[current=page]:border-ink aria-[current=page]:bg-ink aria-[current=page]:text-paper`;

export default function TabBar() {
  const path = usePathname();
  if (!TABS.some((t) => t.href === path)) return null;
  const inMore = TABS.some((t) => t.more && t.href === path);
  return (
    <nav aria-label="Sezioni"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper pb-[env(safe-area-inset-bottom)] lg:hidden">
      <ul className="mx-auto grid max-w-lg grid-cols-5 gap-1.5 px-2 py-2">
        {TABS.map((t) => (
          <li key={t.href} className={t.more ? "hidden" : ""}>
            <Tab tab={t} current={path === t.href} />
          </li>
        ))}
        <li>
          <button type="button" popoverTarget="altro" aria-current={inMore ? "page" : undefined} className={KEY}>
            <DotsThree aria-hidden weight="bold" className="size-6" />
            <span className="text-[0.7rem] font-semibold">Altro</span>
          </button>
        </li>
      </ul>
      <div id="altro" popover="auto"
        className="fixed inset-auto right-2 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] m-0 w-48 rounded-module border border-edge bg-paper p-2 text-ink">
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
        ? <span aria-hidden className="[font-stretch:75%] text-2xl leading-none font-semibold">{t.key}</span>
        : <GearSix aria-hidden weight="bold" className="size-5" />}
      <span className="text-[0.7rem] font-semibold">{t.label}</span>
    </Link>
  );
}
