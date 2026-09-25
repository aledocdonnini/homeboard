"use client";

import { useEffect } from "react";
import type { ExpressionId } from "roby-face/engine";

// Roby su fondo a puntini, con la frase che sta dicendo. Il volto animato vive solo nel browser.
export default function RobyPanel({ expression, says, className = "" }: { expression: ExpressionId; says: string; className?: string }) {
  useEffect(() => { import("roby-face"); }, []);
  return (
    <section aria-label="Roby" className={`flex flex-col justify-between gap-6 rounded-module bg-surface bg-dots p-5 ${className}`}>
      <roby-face expression={expression} background="transparent" color="currentColor" no-glow="" className="w-3/4 self-center text-ink" />
      <p aria-live="polite" className="text-2xl leading-snug font-medium">{says}</p>
    </section>
  );
}
