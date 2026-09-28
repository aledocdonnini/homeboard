import type { DashData } from "./Cruscotto";

// Dati d'esempio per /cruscotto: il cruscotto della PWA senza casa né login. Relativi a oggi.
const at = (days: number) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
};

export const sample: DashData = {
  deadlines: [
    { title: "Bollo auto", due: at(3), daysLeft: 3 },
    { title: "Manutenzione caldaia", due: at(19), daysLeft: 19 },
    { title: "Assicurazione casa", due: at(38), daysLeft: 38 },
  ],
  reminders: [
    { time: "18:30", title: "Ritirare le analisi", note: "Laboratorio di via Roma" },
    { time: "21:00", title: "Portare fuori la plastica" },
    { time: "08:15", title: "Chiamare l'idraulico", note: "Domani" },
  ],
  shopping: {
    todo: ["Pane", "Spaghetti", "Yogurt", "Carta igienica", "Lampadine"],
    inCart: ["Latte", "Mele"],
  },
};
