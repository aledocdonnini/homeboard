"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Item } from "./items";

type Drag = { id: string; from: number; startY: number; dy: number; mids: number[] };

// Riordino dentro un reparto: trascina la maniglia (mouse o dito, Pointer Events) oppure frecce su/giù da tastiera.
// Niente librerie: un reparto ha pochi elementi e basta sapere dove cade il centro della riga trascinata.
export default function SortableGroup({ items, onMove, render }: {
  items: Item[];
  onMove: (id: string, before?: Item, after?: Item) => void;
  render: (item: Item) => ReactNode;
}) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const rows = useRef(new Map<string, HTMLLIElement>());
  const refocus = useRef<string>(null); // spostando la riga nel DOM la maniglia perde il focus: lo rimetto

  useEffect(() => {
    if (!refocus.current) return;
    rows.current.get(refocus.current)?.querySelector<HTMLButtonElement>("button[data-handle]")?.focus();
    refocus.current = null;
  }, [items]);

  function commit(id: string, from: number, to: number) {
    if (to === from) return;
    const others = items.filter((i) => i.id !== id);
    onMove(id, others[to - 1], others[to]);
  }

  // Indice di arrivo: quante altre righe hanno il centro sopra il centro della riga trascinata.
  const target = (d: Drag) => {
    const center = d.mids[d.from]! + d.dy;
    return d.mids.filter((m, i) => i !== d.from && m < center).length;
  };

  return (
    <ul>
      {items.map((item, index) => (
        <li
          key={item.id}
          ref={(el) => { if (el) rows.current.set(item.id, el); else rows.current.delete(item.id); }}
          style={drag?.id === item.id ? { transform: `translateY(${drag.dy}px)`, position: "relative", zIndex: 1 } : undefined}
          className={`flex items-center gap-1 rounded-lg ${drag?.id === item.id ? "bg-background shadow-lg" : ""}`}
        >
          <div className="min-w-0 flex-1">{render(item)}</div>
          {items.length < 2 ? <div className="size-11 shrink-0" /> : (
            <button
              type="button"
              data-handle
              aria-label={`Sposta ${item.name} (frecce su e giù)`}
              className="flex size-11 shrink-0 cursor-grab touch-none items-center justify-center opacity-50"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                const mids = items.map((i) => {
                  const r = rows.current.get(i.id)!.getBoundingClientRect();
                  return r.top + r.height / 2;
                });
                setDrag({ id: item.id, from: index, startY: e.clientY, dy: 0, mids });
              }}
              onPointerMove={(e) => drag?.id === item.id && setDrag({ ...drag, dy: e.clientY - drag.startY })}
              onPointerUp={() => {
                if (drag?.id === item.id) commit(item.id, drag.from, target(drag));
                setDrag(null);
              }}
              onPointerCancel={() => setDrag(null)}
              onKeyDown={(e) => {
                const to = e.key === "ArrowUp" ? index - 1 : e.key === "ArrowDown" ? index + 1 : null;
                if (to === null || to < 0 || to >= items.length) return;
                e.preventDefault();
                refocus.current = item.id;
                commit(item.id, index, to);
              }}
            >
              <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="currentColor">
                {[6, 12, 18].map((y) => [9, 15].map((x) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.6" />))}
              </svg>
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
