"use client";

import { useEffect, useState } from "react";

// Il monoscopio di Homeboard: disegnato da noi, 3:2 come il pannello. Griglia, cerchio con croce,
// grate di risoluzione, scala dei grigi, una banda arancio e l'orologio al centro. Colori fissi: è un'immagine.
const W = 1500, H = 1000, CX = W / 2, CY = H / 2;
const GREYS = ["#0d0d0d", "#2a2a2a", "#474747", "#666", "#858585", "#a5a5a5", "#c6c6c6", "#e8e8e8"];
const INK = "#141414", PAPER = "#e6e4e0", ORANGE = "#ff5a1f";

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/** Grata di risoluzione: linee verticali sempre più fitte. */
function Grating({ x, y, w, h, gaps }: { x: number; y: number; w: number; h: number; gaps: number[] }) {
  const band = w / gaps.length;
  return (
    <g>
      {gaps.flatMap((gap, i) =>
        Array.from({ length: Math.floor(band / (gap * 2)) }, (_, k) => (
          <rect key={`${i}-${k}`} x={x + i * band + k * gap * 2} y={y} width={gap} height={h} fill={INK} />
        )),
      )}
    </g>
  );
}

export default function Monoscope({ caption = "Canale 5", night = false, resume }: { caption?: string; night?: boolean; resume?: string }) {
  const now = useClock();
  const time = now.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={night ? `Fine delle trasmissioni. Riprendono alle ${resume}.` : `Monoscopio, ore ${time}`}
      className="h-full w-full" preserveAspectRatio="xMidYMid slice" style={{ fontFamily: "var(--font-archivo)" }}>
      <rect width={W} height={H} fill="#8a8884" />
      {/* griglia */}
      {Array.from({ length: 16 }, (_, i) => <line key={`v${i}`} x1={i * 100 - 50} y1={0} x2={i * 100 - 50} y2={H} stroke={PAPER} strokeWidth={3} />)}
      {Array.from({ length: 11 }, (_, i) => <line key={`h${i}`} x1={0} y1={i * 100} x2={W} y2={i * 100} stroke={PAPER} strokeWidth={3} />)}
      {/* cerchio */}
      <circle cx={CX} cy={CY} r={440} fill={PAPER} stroke={INK} strokeWidth={10} />
      <clipPath id="mono-circle"><circle cx={CX} cy={CY} r={435} /></clipPath>
      <g clipPath="url(#mono-circle)">
        {/* banda arancio e fascia nera in alto */}
        <rect x={CX - 440} y={CY - 330} width={880} height={110} fill={INK} />
        <text x={CX} y={CY - 257} textAnchor="middle" fontSize={70} fontWeight={700} fill={PAPER} letterSpacing={6}>HOMEBOARD</text>
        <rect x={CX - 440} y={CY - 220} width={880} height={60} fill={ORANGE} />
        {/* grate di risoluzione */}
        <Grating x={CX - 400} y={CY - 150} w={360} h={110} gaps={[10, 7, 5, 3]} />
        <Grating x={CX + 40} y={CY - 150} w={360} h={110} gaps={[3, 5, 7, 10]} />
        {/* scala dei grigi */}
        {GREYS.map((g, i) => <rect key={g} x={CX - 440 + (880 / GREYS.length) * i} y={CY + 170} width={880 / GREYS.length + 1} height={120} fill={g} />)}
        <rect x={CX - 440} y={CY + 290} width={880} height={160} fill={INK} />
        <text x={CX} y={CY + 375} textAnchor="middle" fontSize={54} fontWeight={600} fill={PAPER}>
          {night ? `Riprendono alle ${resume}` : caption}
        </text>
      </g>
      {/* croce */}
      <line x1={CX - 440} y1={CY} x2={CX + 440} y2={CY} stroke={INK} strokeWidth={4} />
      <line x1={CX} y1={CY - 440} x2={CX} y2={CY + 440} stroke={INK} strokeWidth={4} />
      {/* orologio, o il cartello della notte */}
      <rect x={CX - 330} y={CY - 70} width={660} height={140} rx={14} fill={INK} />
      <text x={CX} y={CY + 42} textAnchor="middle" fontSize={night ? 58 : 112} fontWeight={600} fill={PAPER} style={{ fontVariantNumeric: "tabular-nums" }}>
        {night ? "Fine delle trasmissioni" : time}
      </text>
      {/* angoli */}
      {[[40, 40], [W - 140, 40], [40, H - 140], [W - 140, H - 140]].map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={100} height={100} fill={INK} />
      ))}
    </svg>
  );
}
