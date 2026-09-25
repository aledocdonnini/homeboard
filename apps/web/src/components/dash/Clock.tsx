"use client";

import { useEffect, useState } from "react";

const two = (n: number) => String(n).padStart(2, "0");

// Orologio da muro: ore e minuti impilati, secondi in arancio a punti. Solo client (niente mismatch col server).
export default function Clock({ className = "" }: { className?: string }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  if (!now) return <div className={className} />;
  return (
    <time dateTime={now.toISOString()} className={`flex flex-col leading-[0.8] font-semibold tracking-[-0.05em] ${className}`}>
      <span>{two(now.getHours())}</span>
      <span>:{two(now.getMinutes())}</span>
      <span aria-hidden className="pt-4 font-dots text-[0.28em] font-bold tracking-normal text-accent-text">{two(now.getSeconds())}</span>
    </time>
  );
}
