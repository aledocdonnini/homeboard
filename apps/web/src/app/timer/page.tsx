"use client";

import HouseholdGate from "@/features/household/HouseholdGate";
import Timers from "@/features/timers/Timers";

export default function Page() {
  return <HouseholdGate>{(house) => <Timers householdId={house.id} />}</HouseholdGate>;
}
