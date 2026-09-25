import type { InputHTMLAttributes } from "react";
import { Check } from "@phosphor-icons/react/dist/ssr";

// Casella quadrata: spuntata si riempie di nero, come un tasto premuto.
export default function Checkbox(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return (
    <span className="relative inline-flex size-7 shrink-0">
      <input
        type="checkbox"
        {...props}
        className="peer size-7 cursor-pointer appearance-none rounded-control border-2 border-ink bg-surface
          transition-colors duration-100 checked:bg-ink motion-reduce:transition-none"
      />
      <Check aria-hidden weight="bold" className="pointer-events-none absolute inset-1 hidden size-5 text-paper peer-checked:block" />
    </span>
  );
}
