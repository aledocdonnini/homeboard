// Righello a tacche, come la scala di sintonia: una tacca per giorno, quella della scadenza è più alta.
// Le tacche già passate (da oggi alla scadenza) sono piene; oggi è arancio.
export default function TickRuler({ daysLeft, span = 30, className = "" }: { daysLeft: number; span?: number; className?: string }) {
  const due = Math.max(0, Math.min(span, daysLeft));
  return (
    <div aria-hidden className={`flex h-12 items-end justify-between ${className}`}>
      {Array.from({ length: span + 1 }, (_, day) => (
        <span
          key={day}
          className={`w-[3px] rounded-full ${day === 0 ? "h-full bg-accent" : day === due ? "h-full bg-ink" : day < due ? "h-2/3 bg-ink" : "h-1/3 bg-dot-off"}`}
        />
      ))}
    </div>
  );
}
