// Righello a tacche, come la scala di sintonia: una tacca per giorno, quella della scadenza è più alta.
// Le tacche fra oggi e la scadenza sono piene; oggi è arancio. Oltre la scala (scadenza lontana) resta tutto grigio.
export default function TickRuler({ daysLeft, span = 30, className = "" }: { daysLeft: number; span?: number; className?: string }) {
  const due = daysLeft > span ? -1 : Math.max(0, daysLeft);
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
