"use client";

import Screen from "@/features/casa/Screen";
import Timers from "@/features/timers/Timers";

export default function Page() {
  return <Screen view="timers" phone={(house) => <Timers householdId={house.id} />} />;
}
