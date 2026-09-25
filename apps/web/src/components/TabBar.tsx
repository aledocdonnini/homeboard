"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House } from "@phosphor-icons/react";

// I tasti di preselezione del televisore. Il numero è il canale della TV che mostra la stessa cosa.
// Premuto = nero, come un tasto Braun abbassato.
const TABS = [
  { href: "/", label: "Spesa", key: "2" },
  { href: "/promemoria", label: "Promemoria", key: "3" },
  { href: "/scadenze", label: "Scadenze", key: "4" },
  { href: "/casa", label: "Casa", key: null },
];

export default function TabBar() {
  const path = usePathname();
  if (!TABS.some((t) => t.href === path)) return null;
  return (
    <nav aria-label="Sezioni" className="fixed inset-x-0 bottom-0 border-t border-line bg-paper pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto grid max-w-md grid-cols-4 gap-1.5 px-2 py-2">
        {TABS.map((t) => (
          <li key={t.href}>
            <Link
              href={t.href}
              aria-current={path === t.href ? "page" : undefined}
              className="flex min-h-14 flex-col items-center justify-center rounded-control border border-b-4 border-edge bg-surface
                active:translate-y-px aria-[current=page]:border-ink aria-[current=page]:bg-ink aria-[current=page]:text-paper"
            >
              {t.key ? <span aria-hidden className="font-dots text-2xl font-bold leading-none">{t.key}</span> : <House aria-hidden weight="bold" className="size-5" />}
              <span className="text-xs font-semibold">{t.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
