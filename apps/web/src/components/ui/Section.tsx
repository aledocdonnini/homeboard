import type { ReactNode } from "react";

// Impianto delle schermate interne, come il cruscotto.
// Telefono: una colonna (testata e azioni, poi il contenuto).
// Desktop: a tutto schermo, testata e azioni ferme a sinistra, contenuto a destra; con l'effetto CRT.
export default function Section({ aside, children }: { aside: ReactNode; children: ReactNode }) {
  return (
    <div className="crt min-h-[100dvh]">
      <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 pt-6 pb-32
        lg:grid lg:min-h-[100dvh] lg:max-w-none lg:grid-cols-12 lg:items-start lg:gap-x-14 lg:p-10">
        <div className="flex flex-col gap-6 lg:sticky lg:top-10 lg:col-span-4">{aside}</div>
        <div className="flex flex-col gap-6 lg:col-span-8 lg:pt-2">{children}</div>
      </main>
    </div>
  );
}
