"use client";

import { useMemo, useState } from "react";
import { Plus } from "@phosphor-icons/react";
import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import EmptyState from "@/components/ui/EmptyState";
import Big from "@/components/dash/Big";
import DotGrid from "@/components/dash/DotGrid";
import PageHeader from "@/components/ui/PageHeader";
import Section from "@/components/ui/Section";
import { arrange, CATEGORIES, normalize, parseQuickAdd, suggest, type Item } from "@homeboard/core/items";
import { useShoppingList } from "./useShoppingList";
import SortableGroup from "./SortableGroup";
import SyncStatus from "./SyncStatus";

export default function ShoppingList({ householdId }: { householdId: string }) {
  const list = useShoppingList(householdId);
  const [text, setText] = useState("");
  const { groups, checked } = useMemo(() => arrange(list.items), [list.items]);
  const onList = useMemo(
    () => new Set(list.items.filter((i) => !i.deleted_at && !i.checked).map((i) => normalize(i.name))),
    [list.items],
  );
  // Suggerisce solo mentre si scrive l'ultima voce ("latte, uo" → suggerimenti per "uo").
  const current = text.split(/[,;\n]/).at(-1) ?? "";
  const suggestions = suggest(list.stats, current, onList);
  const todo = groups.reduce((n, g) => n + g.items.length, 0);
  const total = todo + checked.length;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    list.add(parseQuickAdd(text));
    setText("");
  }

  function pick(name: string) {
    const rest = text.split(/[,;\n]/).slice(0, -1).join(",");
    list.add(parseQuickAdd(`${rest},${name}`));
    setText("");
  }

  const aside = (
    <>
      <PageHeader title="Spesa">
        <p className="flex items-end gap-3">
          <Big className="text-8xl lg:text-[10rem]">{list.loaded ? String(todo).padStart(2, "0") : "--"}</Big>
          <span className="pb-2 text-xl text-muted">da prendere{checked.length ? `, ${checked.length} nel carrello` : ""}</span>
        </p>
        {total > 0 && <DotGrid filled={todo} total={total} cols={10} />}
      </PageHeader>
      <SyncStatus pending={list.pending} />

      <form onSubmit={submit} className="flex flex-col gap-3">
        <label htmlFor="add" className="sr-only">Aggiungi alla lista</label>
        <div className="flex gap-2">
          <input
            id="add" value={text} onChange={(e) => setText(e.target.value)} enterKeyHint="done" autoComplete="off"
            placeholder="Latte, uova, pane"
            className="min-h-12 min-w-0 flex-1 rounded-control border border-edge bg-surface px-4 text-lg"
          />
          <Button type="submit" disabled={!text.trim()} aria-label="Aggiungi" className="px-4">
            <Plus aria-hidden weight="bold" className="size-5" />
          </Button>
        </div>
        {suggestions.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label="Aggiunti spesso">
            {suggestions.map((s) => (
              <li key={s.name_norm}>
                <button
                  type="button" onClick={() => pick(s.name)}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-control border border-edge bg-surface px-3 active:translate-y-px"
                >
                  <Plus aria-hidden className="size-4 text-muted" />
                  {s.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </form>

      {list.error && <p role="alert" className="text-danger">Una modifica è stata rifiutata dal server: {list.error}</p>}
    </>
  );

  return (
    <Section aside={aside}>
      {!list.loaded ? (
        <div aria-hidden className="flex flex-col gap-3">
          {[60, 45, 70].map((w) => <div key={w} className="h-12 rounded-control bg-line/50" style={{ width: `${w}%` }} />)}
        </div>
      ) : todo === 0 ? (
        <EmptyState title={checked.length ? "Hai preso tutto" : "La lista è vuota"}>
          {checked.length
            ? "Togli dalla lista quello che è nel carrello, così la prossima volta si riparte puliti."
            : "Scrivi qui sopra cosa manca. Puoi aggiungere più cose insieme, separate da virgole."}
        </EmptyState>
      ) : (
        // Desktop: i reparti su due colonne, ognuno intero in una colonna.
        <div className="flex flex-col gap-6 lg:block lg:columns-2 lg:gap-x-14">
          {groups.map((g) => (
            <section key={g.category} aria-labelledby={`cat-${g.category}`} className="flex break-inside-avoid flex-col lg:mb-8">
              <h2 id={`cat-${g.category}`} className="text-base font-semibold text-muted">{g.label}</h2>
              <SortableGroup items={g.items} onMove={list.move} render={(item) => <Row item={item} list={list} />} />
            </section>
          ))}
        </div>
      )}

      {checked.length > 0 && (
        <section aria-labelledby="checked" className="flex flex-col border-t-4 border-ink pt-4">
          <div className="flex items-center justify-between">
            <h2 id="checked" className="text-base font-semibold text-muted">Nel carrello ({checked.length})</h2>
            <Button variant="link" onClick={list.clearChecked}>Togli dalla lista</Button>
          </div>
          <ul>
            {checked.map((item) => <li key={item.id} className="border-b border-line pr-11 last:border-b-0"><Row item={item} list={list} /></li>)}
          </ul>
        </section>
      )}
    </Section>
  );
}

function Row({ item, list }: { item: Item; list: ReturnType<typeof useShoppingList> }) {
  return (
    <div className="flex min-h-14 items-center gap-3">
      <Checkbox id={`item-${item.id}`} checked={item.checked} onChange={(e) => list.setChecked(item.id, e.target.checked)} />
      <label htmlFor={`item-${item.id}`} className={`flex-1 py-3 text-xl leading-snug font-medium lg:text-2xl ${item.checked ? "text-muted line-through font-normal" : ""}`}>
        {item.name}
      </label>
      {!item.checked && (
        <select
          aria-label={`Reparto di ${item.name}`} value={item.category}
          onChange={(e) => list.setCategory(item.id, e.target.value)}
          className="w-24 truncate rounded-control border border-edge bg-transparent px-2 py-1.5 text-sm text-muted"
        >
          {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      )}
    </div>
  );
}
