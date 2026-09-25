import type { InputHTMLAttributes } from "react";

// Etichetta sopra, campo, poi aiuto o errore sotto (collegati con aria-describedby).
export default function Field({ label, id, hint, error, className = "", ...input }:
  InputHTMLAttributes<HTMLInputElement> & { label: string; id: string; hint?: string; error?: string }) {
  const note = error || hint ? `${id}-note` : undefined;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="font-semibold">{label}</label>
      <input
        id={id}
        aria-describedby={note}
        aria-invalid={error ? true : undefined}
        {...input}
        className={`min-h-12 rounded-control border border-edge bg-surface px-4 text-lg aria-invalid:border-danger ${className}`}
      />
      {note && (
        <p id={note} className={error ? "text-danger" : "text-muted"} role={error ? "alert" : undefined}>{error || hint}</p>
      )}
    </div>
  );
}
