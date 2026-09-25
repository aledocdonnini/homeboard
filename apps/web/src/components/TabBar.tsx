"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Spesa" },
  { href: "/casa", label: "Casa" },
];

// Barra in basso della PWA: solo sulle pagine dell'app, non su login, inviti, TV e demo.
export default function TabBar() {
  const path = usePathname();
  if (!TABS.some((t) => t.href === path)) return null;
  return (
    <nav aria-label="Sezioni" className="fixed inset-x-0 bottom-0 border-t bg-background pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto flex max-w-md">
        {TABS.map((t) => (
          <li key={t.href} className="flex-1">
            <Link
              href={t.href}
              aria-current={path === t.href ? "page" : undefined}
              className="flex min-h-14 items-center justify-center opacity-60 aria-[current=page]:font-semibold aria-[current=page]:opacity-100"
            >
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
