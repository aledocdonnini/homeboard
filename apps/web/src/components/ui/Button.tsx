import type { ButtonHTMLAttributes } from "react";

const VARIANTS = {
  primary: "bg-accent text-on-accent",
  quiet: "border border-edge bg-surface text-ink",
  link: "min-h-11 px-0 underline underline-offset-4 font-normal",
};

export default function Button({ variant = "primary", className = "", ...props }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof VARIANTS }) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-control px-5 font-semibold whitespace-nowrap
        active:translate-y-px disabled:opacity-50 disabled:active:translate-y-0 ${VARIANTS[variant]} ${className}`}
    />
  );
}
