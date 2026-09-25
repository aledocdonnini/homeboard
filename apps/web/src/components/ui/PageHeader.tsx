import type { ReactNode } from "react";

export default function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="flex items-end justify-between gap-4 pt-2">
      <h1 className="text-4xl font-bold tracking-tight">{title}</h1>
      {children}
    </header>
  );
}
