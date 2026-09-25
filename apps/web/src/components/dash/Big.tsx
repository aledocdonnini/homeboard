import type { ReactNode } from "react";

// Il numero enorme: il contenuto di ogni modulo. Stretto in altezza, spaziatura negativa, cifre a larghezza fissa.
export default function Big({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`block leading-[0.82] font-semibold tracking-[-0.05em] ${className}`}>{children}</span>;
}
