import type { ReactNode } from "react";

// Testata di sezione, come un modulo del cruscotto: il nome piccolo in alto, sotto il numero che conta,
// poi una riga nera spessa che apre il contenuto.
export default function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="flex flex-col gap-3 border-b-4 border-ink pb-5">
      <h1 className="text-xl font-semibold">{title}</h1>
      {children}
    </header>
  );
}
