import { test } from "node:test";
import assert from "node:assert/strict";
import { isNight, nothingOnAir, summary } from "./broadcast.ts";
import type { DashData } from "./Cruscotto.tsx";

const empty: DashData = { deadlines: [], reminders: [], shopping: { todo: [], inCart: [] } };
const day = new Date(2026, 8, 28);

test("notte: anche quando scavalca la mezzanotte", () => {
  assert.equal(isNight("23:45", "23:30", "07:00"), true);
  assert.equal(isNight("03:00", "23:30", "07:00"), true);
  assert.equal(isNight("07:00", "23:30", "07:00"), false, "alle 7 riprendono le trasmissioni");
  assert.equal(isNight("12:00", "23:30", "07:00"), false);
  assert.equal(isNight("14:00", "13:00", "15:00"), true, "anche un pisolino pomeridiano");
});

test("monoscopio quando non c'è niente di rilevante", () => {
  assert.equal(nothingOnAir(empty), true);
  assert.equal(nothingOnAir({ ...empty, deadlines: [{ title: "Bollo", due: day, daysLeft: 40 }] }), true, "scadenza lontana");
  assert.equal(nothingOnAir({ ...empty, deadlines: [{ title: "Bollo", due: day, daysLeft: 3 }] }), false);
  assert.equal(nothingOnAir({ ...empty, shopping: { todo: ["Pane"], inCart: [] } }), false);
});

test("riepilogo di Roby", () => {
  const d: DashData = {
    deadlines: [{ title: "Bolletta luce", due: day, daysLeft: -1 }, { title: "Bollo auto", due: day, daysLeft: 3 }, { title: "Caldaia", due: day, daysLeft: 19 }],
    reminders: [{ time: "21:00", title: "Portare fuori la plastica" }],
    shopping: { todo: ["Basilico", "Pesto", "Yogurt", "Pane"], inCart: [] },
  };
  assert.equal(summary(d, 20),
    "Buonasera. Bolletta luce è scaduta da 1 giorno. Bollo auto scade tra 3 giorni. Alle 21:00: portare fuori la plastica. In lista ci sono 4 cose: basilico, pesto e altre 2.");
  assert.equal(summary({ ...empty, shopping: { todo: ["Latte", "Uova"], inCart: [] } }, 9), "Buongiorno. In lista: latte e uova.");
  assert.equal(summary(empty, 15), "Buon pomeriggio. La lista della spesa è vuota.");
});
