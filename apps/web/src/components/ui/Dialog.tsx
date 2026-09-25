"use client";

import { useEffect, useRef, type ReactNode } from "react";

// Finestra modale nativa (<dialog>): focus intrappolato, Esc per chiudere e ritorno del focus li fa il browser.
export default function Dialog({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current!;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="dialog-title"
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-module bg-paper p-0 text-ink backdrop:bg-black/60"
    >
      <div className="flex flex-col gap-5 p-5">
        <h2 id="dialog-title" className="border-b-4 border-ink pb-3 text-2xl font-semibold">{title}</h2>
        {children}
      </div>
    </dialog>
  );
}
