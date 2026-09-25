// Dati d'esempio per /cruscotto, finché la TV non legge quelli veri (fase 7). Relativi a oggi.
const at = (days: number) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
};

export type SampleDeadline = { title: string; due: Date; daysLeft: number };
export type SampleReminder = { time: string; title: string; note?: string };

export const sample = {
  deadlines: [
    { title: "Bollo auto", due: at(3), daysLeft: 3 },
    { title: "Manutenzione caldaia", due: at(19), daysLeft: 19 },
    { title: "Assicurazione casa", due: at(38), daysLeft: 38 },
  ] as SampleDeadline[],
  reminders: [
    { time: "18:30", title: "Ritirare le analisi", note: "Laboratorio di via Roma" },
    { time: "21:00", title: "Portare fuori la plastica" },
    { time: "08:15", title: "Chiamare l'idraulico", note: "Domani" },
  ] as SampleReminder[],
  shopping: {
    todo: ["Pane", "Spaghetti", "Yogurt", "Carta igienica", "Lampadine"],
    inCart: ["Latte", "Mele"],
  },
};
