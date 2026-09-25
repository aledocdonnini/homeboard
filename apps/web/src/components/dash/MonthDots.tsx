// Il mese a pallini: passati neri, oggi arancio, futuri grigi; i giorni con una scadenza hanno un anello.
const WEEKDAYS = ["L", "M", "M", "G", "V", "S", "D"];

export default function MonthDots({ today, marked = [], className = "" }: { today: Date; marked?: number[]; className?: string }) {
  const year = today.getFullYear(), month = today.getMonth(), day = today.getDate();
  const offset = (new Date(year, month, 1).getDay() + 6) % 7; // lunedì = 0
  const days = new Date(year, month + 1, 0).getDate();
  return (
    <div aria-hidden className={`grid grid-cols-7 gap-1.5 ${className}`}>
      {WEEKDAYS.map((w, i) => <span key={i} className={`text-center text-xs ${i === (today.getDay() + 6) % 7 ? "text-accent-text font-semibold" : "text-muted"}`}>{w}</span>)}
      {Array.from({ length: offset }, (_, i) => <span key={`x${i}`} />)}
      {Array.from({ length: days }, (_, i) => {
        const d = i + 1;
        const fill = d < day ? "bg-ink" : d === day ? "bg-accent" : "bg-dot-off";
        return <span key={d} className={`aspect-square rounded-full ${fill} ${marked.includes(d) && d > day ? "ring-2 ring-ink ring-inset" : ""}`} />;
      })}
    </div>
  );
}
