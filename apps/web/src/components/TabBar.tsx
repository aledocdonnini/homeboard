"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House } from "@phosphor-icons/react";

// I tasti di preselezione del televisore. Il numero è il canale della TV che mostra la stessa cosa.
const TABS = [
  { href: "/", label: "Spesa", channel: "spesa", key: "2" },
  { href: "/promemoria", label: "Promemoria", channel: "promemoria", key: "3" },
  { href: "/scadenze", label: "Scadenze", channel: "scadenze", key: "4" },
  { href: "/casa", label: "Casa", channel: "casa", key: null },
];

export default function TabBar() {
  const path = usePathname();
  if (!TABS.some((t) => t.href === path)) return null;
  return (
    <nav aria-label="Sezioni" className="fixed inset-x-0 bottom-0 border-t border-line bg-paper pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto grid max-w-md grid-cols-4 gap-1.5 px-2 py-2">
        {TABS.map((t) => (
          <li key={t.href} data-channel={t.channel}>
            <Link
              href={t.href}
              aria-current={path === t.href ? "page" : undefined}
              className="flex min-h-14 flex-col items-center justify-center rounded-control border border-b-4 border-edge bg-surface
                active:translate-y-px aria-[current=page]:border-ink aria-[current=page]:bg-channel aria-[current=page]:text-on-channel"
            >
              {t.key ? <span aria-hidden className="font-osd text-3xl leading-[0.7]">{t.key}</span> : <House aria-hidden weight="bold" className="size-5" />}
              <span className="text-xs font-semibold">{t.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
