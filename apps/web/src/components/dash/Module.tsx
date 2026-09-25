import type { ReactNode } from "react";

// Un apparecchio: etichetta piccola in alto, poi il valore. Piatto, niente ombre.
export default function Module({ label, children, className = "", tone = "surface" }:
  { label?: string; children: ReactNode; className?: string; tone?: "surface" | "accent" | "plain" }) {
  const bg = { surface: "bg-surface", accent: "bg-accent text-on-accent", plain: "" }[tone];
  return (
    <section aria-label={label} className={`flex flex-col gap-3 rounded-module p-5 ${bg} ${className}`}>
      {label && <p aria-hidden className={`text-sm font-medium ${tone === "accent" ? "" : "text-muted"}`}>{label}</p>}
      {children}
    </section>
  );
}
