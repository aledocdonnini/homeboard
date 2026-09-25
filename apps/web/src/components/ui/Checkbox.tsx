import type { InputHTMLAttributes } from "react";
import { Check } from "@phosphor-icons/react/dist/ssr";

// Casella quadrata come i blocchi del Televideo: spuntata si riempie del colore del canale.
export default function Checkbox(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return (
    <span className="relative inline-flex size-7 shrink-0">
      <input
        type="checkbox"
        {...props}
        className="peer size-7 cursor-pointer appearance-none rounded-control border-2 border-ink bg-surface
          transition-colors duration-100 checked:bg-channel motion-reduce:transition-none"
      />
      <Check aria-hidden weight="bold" className="pointer-events-none absolute inset-1 hidden size-5 text-on-channel peer-checked:block" />
    </span>
  );
}
