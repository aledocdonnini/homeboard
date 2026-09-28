"use client";

import type { Freq, Recurrence } from "@homeboard/core/recurrence";

export type Preset = { label: string; value: Recurrence | null };
const UNIT_LABEL: Record<Freq, string> = { day: "giorni", week: "settimane", month: "mesi", year: "anni" };
const WEEKDAYS = ["L", "M", "M", "G", "V", "S", "D"];
const WEEKDAY_NAMES = ["lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato", "domenica"];
const same = (a: Recurrence | null, b: Recurrence | null) => a?.freq === b?.freq && a?.interval === b?.interval && !a === !b;

// "Ripeti": scorciatoie comuni più "Personalizzata" (ogni N unità), e i giorni della settimana per le settimanali.
export default function RecurrencePicker({ id, value, onChange, presets, units, defaultWeekday }: {
  id: string;
  value: Recurrence | null;
  onChange: (r: Recurrence | null) => void;
  presets: Preset[];
  units: Freq[];
  defaultWeekday: number;
}) {
  const presetIndex = presets.findIndex((p) => same(p.value, value));
  const custom = presetIndex === -1;
  const set = (patch: Partial<Recurrence>) => onChange({ freq: value?.freq ?? units[0]!, interval: value?.interval ?? 1, ...value, ...patch });

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="pb-2 font-semibold">Ripeti</legend>
      <select
        id={id} aria-label="Ripeti" value={custom ? "custom" : presetIndex}
        onChange={(e) => {
          if (e.target.value === "custom") return onChange({ freq: units[0]!, interval: 2 });
          const p = presets[Number(e.target.value)]!.value;
          onChange(p?.freq === "week" ? { ...p, byWeekday: [defaultWeekday] } : p);
        }}
        className="min-h-12 rounded-control border border-edge bg-surface px-3 text-lg"
      >
        {presets.map((p, i) => <option key={p.label} value={i}>{p.label}</option>)}
        <option value="custom">Personalizzata</option>
      </select>

      {custom && value && (
        <div className="flex items-center gap-2">
          <span>Ogni</span>
          <input
            type="number" inputMode="numeric" min={1} max={99} aria-label="Ogni quanti" value={value.interval}
            onChange={(e) => set({ interval: Math.min(99, Math.max(1, Number(e.target.value) || 1)) })}
            className="min-h-12 w-20 rounded-control border border-edge bg-surface px-3 text-lg"
          />
          <select
            aria-label="Unità" value={value.freq}
            onChange={(e) => {
              const freq = e.target.value as Freq;
              set({ freq, byWeekday: freq === "week" ? [defaultWeekday] : undefined });
            }}
            className="min-h-12 rounded-control border border-edge bg-surface px-3 text-lg"
          >
            {units.map((u) => <option key={u} value={u}>{UNIT_LABEL[u]}</option>)}
          </select>
        </div>
      )}

      {value?.freq === "week" && (
        <div role="group" aria-label="Giorni della settimana" className="flex gap-1.5">
          {WEEKDAYS.map((w, i) => {
            const on = value.byWeekday?.includes(i) ?? false;
            return (
              <button
                key={i} type="button" aria-pressed={on} aria-label={WEEKDAY_NAMES[i]}
                onClick={() => {
                  const days = on ? (value.byWeekday ?? []).filter((d) => d !== i) : [...(value.byWeekday ?? []), i];
                  if (days.length) set({ byWeekday: days.sort() });
                }}
                className="size-11 rounded-control border border-edge bg-surface font-semibold aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-paper"
              >
                {w}
              </button>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}
