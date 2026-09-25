// Pallini, come la griglia dell'altoparlante: pieni = da fare, vuoti = fatti.
export default function DotGrid({ filled, total, cols = 10, className = "" }:
  { filled: number; total: number; cols?: number; className?: string }) {
  return (
    <div aria-hidden className={`grid gap-1.5 ${className}`} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`aspect-square rounded-full ${i < filled ? "bg-ink" : "bg-dot-off"}`} />
      ))}
    </div>
  );
}
