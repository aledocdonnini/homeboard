// Numero in stile OSD del televisore, sul colore del canale. Il significato va detto a parole in `label`.
export default function Osd({ value, label }: { value: number; label: string }) {
  return (
    <p className="flex items-center gap-3">
      <span className="text-muted">{label}</span>
      <span aria-hidden className="min-w-[2ch] rounded-control bg-channel px-2 pt-1 text-center font-osd text-5xl leading-[0.8] text-on-channel">
        {String(value).padStart(2, "0")}
      </span>
    </p>
  );
}
