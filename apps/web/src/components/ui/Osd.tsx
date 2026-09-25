// Lettura su display, come il riquadro nero di un apparecchio: cifre strette su fondo scuro.
// Il significato va detto a parole in `label`.
export default function Osd({ value, label }: { value: number; label: string }) {
  return (
    <p className="flex items-center gap-3">
      <span className="text-muted">{label}</span>
      <span aria-hidden className="min-w-[2ch] rounded-control border border-edge bg-[#141414] px-2.5 py-1 text-center [font-stretch:75%] font-semibold text-4xl leading-none text-[#eeedea]">
        {String(value).padStart(2, "0")}
      </span>
    </p>
  );
}
