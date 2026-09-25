"use client";

import { useMemo, useState } from "react";
import { arrange, CATEGORIES, normalize, parseQuickAdd, suggest, type Item } from "./items";
import { useShoppingList } from "./useShoppingList";
import SortableGroup from "./SortableGroup";

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

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 p-4 pb-28">
      <header className="flex items-baseline justify-between">
        <h1 className="text-3xl font-semibold">Spesa</h1>
        <p className="opacity-70" aria-live="polite">{todo ? `${todo} da prendere` : "Tutto preso"}</p>
      </header>

      <form onSubmit={submit} className="flex flex-col gap-3">
        <label htmlFor="add" className="sr-only">Aggiungi alla lista</label>
        <div className="flex gap-2">
          <input
            id="add" value={text} onChange={(e) => setText(e.target.value)} enterKeyHint="done" autoComplete="off"
            placeholder="Latte, uova, pane…"
            className="min-w-0 flex-1 rounded-xl border bg-transparent px-4 py-3 text-lg"
          />
          <button className="rounded-xl bg-foreground px-4 text-background" disabled={!text.trim()}>Aggiungi</button>
        </div>
        {suggestions.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label="Suggerimenti">
            {suggestions.map((s) => (
              <li key={s.name_norm}>
                <button type="button" onClick={() => pick(s.name)} className="min-h-11 rounded-full border px-4 text-sm">
                  + {s.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </form>

      <p role="alert" className="text-red-600 empty:hidden dark:text-red-400">{list.error}</p>

      {groups.map((g) => (
        <section key={g.category} aria-labelledby={`cat-${g.category}`} className="flex flex-col gap-1">
          <h2 id={`cat-${g.category}`} className="text-sm font-medium uppercase tracking-wide opacity-60">{g.label}</h2>
          <SortableGroup items={g.items} onMove={list.move} render={(item) => <Row item={item} list={list} />} />
        </section>
      ))}

      {checked.length > 0 && (
        <section aria-labelledby="checked" className="flex flex-col gap-1 opacity-70">
          <div className="flex items-baseline justify-between">
            <h2 id="checked" className="text-sm font-medium uppercase tracking-wide">Nel carrello ({checked.length})</h2>
            <button type="button" onClick={list.clearChecked} className="min-h-11 text-sm underline">Togli dalla lista</button>
          </div>
          <ul>
            {checked.map((item) => <li key={item.id}><Row item={item} list={list} /></li>)}
          </ul>
        </section>
      )}
    </main>
  );
}

function Row({ item, list }: { item: Item; list: ReturnType<typeof useShoppingList> }) {
  return (
    <div className="flex min-h-12 items-center gap-3">
      <input
        id={`item-${item.id}`} type="checkbox" checked={item.checked}
        onChange={(e) => list.setChecked(item.id, e.target.checked)}
        className="size-6 shrink-0 accent-current"
      />
      <label htmlFor={`item-${item.id}`} className={`flex-1 py-2 text-lg ${item.checked ? "line-through" : ""}`}>
        {item.name}
      </label>
      {!item.checked && (
        <select
          aria-label={`Reparto di ${item.name}`} value={item.category}
          onChange={(e) => list.setCategory(item.id, e.target.value)}
          className="max-w-28 truncate rounded-lg border bg-transparent px-2 py-1 text-sm opacity-70"
        >
          {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      )}
    </div>
  );
}
